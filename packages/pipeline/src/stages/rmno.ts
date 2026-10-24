import { db, jsonb } from "@repo/db";
import { normalise, stripTitles } from "../lib/names";
import { mapPool } from "../lib/pool";
import type { Stats } from "../lib/run";
import { type Snapshot, storeSnapshot } from "../lib/snapshot";
import { sourceId } from "../lib/sources";

const BASE = "https://ives.minv.sk/rmno";
const ELECTION_DAY = new Date("2026-10-24");
const USER_AGENT = "KohoVolim/0.1 (neutral candidate profiles)";

/** Section headings on an RMNO extract under which people are listed. */
const PERSON_SECTIONS = [
  "Členovia prípravného výboru",
  "Štatutárny orgán",
  "Zakladateľ",
  "Zakladatelia",
  "Správna rada",
  "Dozorná rada",
  "Revízor",
  "Likvidátor",
];

/** Minimal cookie-keeping client: the search form needs a session and an anti-forgery token. */
class Session {
  private cookies = new Map<string, string>();
  private token: string | null = null;

  private remember(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair!.indexOf("=");
      this.cookies.set(pair!.slice(0, i), pair!.slice(i + 1));
    }
  }

  private headers(extra: Record<string, string> = {}) {
    return {
      "user-agent": USER_AGENT,
      cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
      ...extra,
    };
  }

  async get(url: string): Promise<{ status: number; body: Buffer }> {
    const res = await fetch(url, {
      headers: this.headers(),
      redirect: "manual",
    });
    this.remember(res);
    return { status: res.status, body: Buffer.from(await res.arrayBuffer()) };
  }

  async search(given: string, family: string): Promise<Buffer> {
    if (!this.token) {
      const form = (await this.get(BASE)).body.toString("utf-8");
      this.token =
        form.match(
          /name="__RequestVerificationToken" type="hidden" value="([^"]+)"/,
        )?.[1] ?? null;
      if (!this.token) throw new Error("RMNO: no anti-forgery token");
    }
    const body = new URLSearchParams({
      __RequestVerificationToken: this.token,
      "filter.typ_osoby": "fo",
      "filter.osoba_meno": given,
      "filter.osoba_priezvisko": family,
    });
    const res = await fetch(BASE, {
      method: "POST",
      headers: this.headers({
        "content-type": "application/x-www-form-urlencoded",
      }),
      body,
      redirect: "manual",
    });
    this.remember(res);
    const location = res.headers.get("location");
    if (res.status !== 302 || !location) {
      this.token = null;
      throw new Error(`RMNO search: HTTP ${res.status}`);
    }
    return (await this.get(new URL(location, BASE).toString())).body;
  }
}

function lines(html: string): string[] {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function after(ls: string[], label: string): string | null {
  const i = ls.findIndex((l) => l === label || l.startsWith(label));
  return i >= 0 ? (ls[i + 1] ?? null) : null;
}

function ageOn(dmy: string): number {
  const [d, m, y] = dmy.split(".").map(Number) as [number, number, number];
  let age = ELECTION_DAY.getFullYear() - y;
  if (
    ELECTION_DAY.getMonth() + 1 < m ||
    (ELECTION_DAY.getMonth() + 1 === m && ELECTION_DAY.getDate() < d)
  ) {
    age--;
  }
  return age;
}

interface Organisation {
  name: string | null;
  ico: string | null;
  legalForm: string | null;
  seat: string | null;
  founded: string | null;
  people: {
    name: string;
    age: number;
    section: string;
    func: string | null;
    from: string | null;
  }[];
}

function parseDetail(html: string): Organisation {
  const ls = lines(html);
  const start = ls.findIndex((l) => l === "Úplný výpis");
  const body = start >= 0 ? ls.slice(start + 1) : ls;
  const nameLabel = body.find((l) => l.startsWith("Názov"));
  const people: Organisation["people"] = [];
  let section = "";
  for (let i = 0; i < body.length; i++) {
    const l = body[i]!;
    if (PERSON_SECTIONS.some((s) => l.startsWith(s))) section = l;
    const born = l.match(/^nar\. (\d{2}\.\d{2}\.\d{4})$/);
    if (!born || !section) continue;
    let j = i - 1;
    while (j >= 0 && body[j]!.startsWith("Osoba má zapísané")) j--;
    let func: string | null = null;
    let from: string | null = null;
    for (let k = i + 1; k < Math.min(i + 9, body.length); k++) {
      if (/^nar\. /.test(body[k]!)) break;
      if (body[k] === "Funkcia") func = body[k + 1] ?? null;
      if (body[k] === "Od" && !from) from = body[k + 1] ?? null;
    }
    people.push({ name: body[j]!, age: ageOn(born[1]!), section, func, from });
  }
  return {
    name: nameLabel ? after(body, nameLabel) : null,
    ico: after(body, "IČO"),
    legalForm: after(body, "Právna forma"),
    seat: after(body, "Sídlo"),
    founded: after(body, "Dátum vzniku"),
    people,
  };
}

function isoDate(dmy: string | null): string | null {
  const m = dmy?.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * Roles in civic associations, foundations, non-profits and non-investment funds. The register
 * publishes full birth dates, so a role links only when name and age (from the birth date) match;
 * the birth date itself is not stored.
 */
export async function rmno(): Promise<Stats> {
  const source = await sourceId("rmno");
  const persons = await db
    .selectFrom("person")
    .select(["id", "given_name", "family_name", "normalised_name", "age_2026"])
    // PIPELINE_ONLY=<comma-separated surnames> restricts a run for testing.
    .$if(!!process.env.PIPELINE_ONLY, (q) =>
      q.where("family_name", "in", process.env.PIPELINE_ONLY!.split(",")),
    )
    .execute();

  const session = new Session();
  const details = new Map<
    string,
    Promise<{ org: Organisation; snapshot: Snapshot }>
  >();
  const detail = (id: string) => {
    let d = details.get(id);
    if (!d) {
      d = (async () => {
        const url = `${BASE}/detail/${id}`;
        const res = await session.get(url);
        const snapshot = await storeSnapshot(
          "rmno",
          url,
          res.body,
          res.status,
          "text/html",
        );
        return { org: parseDetail(res.body.toString("utf-8")), snapshot };
      })();
      details.set(id, d);
    }
    return d;
  };

  type Row = {
    person_id: string;
    payload: Record<string, unknown>;
    from: string | null;
    snapshot: Snapshot;
  };
  const rows: Row[] = [];
  let searched = 0;
  let failed = 0;
  let capped = 0;
  let rejectedByAge = 0;

  await mapPool(persons, 2, 250, async (p) => {
    let html: Buffer | null = null;
    for (let attempt = 1; attempt <= 3 && !html; attempt++) {
      try {
        html = await session.search(p.given_name, p.family_name);
      } catch {
        await new Promise((r) => setTimeout(r, 3000 * attempt));
      }
    }
    if (!html) {
      failed++;
      return;
    }
    searched++;
    const text = html.toString("utf-8");
    if (
      /Zobrazuje sa maximálne 200/.test(text) &&
      /\b200 výsledkov\b/.test(text)
    )
      capped++;
    const ids = [
      ...new Set(
        [...text.matchAll(/href="detail\/(\d+)\s*"/g)].map((m) => m[1]!),
      ),
    ];
    for (const id of ids) {
      const { org, snapshot } = await detail(id);
      for (const person of org.people) {
        if (normalise(stripTitles(person.name)) !== p.normalised_name) continue;
        if (Math.abs(person.age - p.age_2026) > 1) {
          rejectedByAge++;
          continue;
        }
        rows.push({
          person_id: p.id,
          payload: {
            organisation: org.name,
            ico: org.ico,
            legal_form: org.legalForm,
            seat: org.seat,
            role: person.section,
            function: person.func,
            rmno_detail_id: id,
          },
          from: isoDate(person.from) ?? isoDate(org.founded),
          snapshot,
        });
      }
    }
  });

  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    const key = `${r.person_id}|${r.payload.rmno_detail_id}|${r.payload.role}|${r.payload.function}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom("fact")
      .where("type", "=", "ngo_role")
      .where("source_id", "=", source)
      .execute();
    for (const r of unique) {
      await trx
        .insertInto("fact")
        .values({
          person_id: r.person_id,
          type: "ngo_role",
          payload: jsonb(r.payload),
          occurred_from: r.from,
          source_id: source,
          source_url: r.snapshot.url,
          snapshot_id: r.snapshot.id,
          method: "register",
          match_reason: jsonb({
            matched: ["name", "age"],
            basis: "birth_date_in_register",
          }),
        })
        .execute();
    }
  });

  return {
    persons_searched: searched,
    failed_searches: failed,
    capped_at_200: capped,
    organisations_read: details.size,
    roles_linked: unique.length,
    persons_with_roles: new Set(unique.map((r) => r.person_id)).size,
    rejected_by_age: rejectedByAge,
  };
}
