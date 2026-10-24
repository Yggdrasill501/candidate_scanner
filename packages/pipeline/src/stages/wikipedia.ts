import { db, jsonb, sql } from "@repo/db";
import { normalise } from "../lib/names";
import type { Stats } from "../lib/run";
import { fetchSnapshot, type Snapshot } from "../lib/snapshot";
import { sourceId } from "../lib/sources";

const ELECTION_YEAR = 2026;
const HUNGARIAN_DISTRICTS = new Set(["Komárno", "Nové Zámky", "Levice"]);
/** Wikidata properties shown on a profile, with their meaning. */
const PROPS = {
  P39: "position_held",
  P102: "party",
  P106: "occupation",
  P69: "educated_at",
} as const;

interface Page {
  title: string;
  extract?: string;
  pageprops?: { wikibase_item?: string; disambiguation?: string };
  missing?: string;
}

interface Claim {
  mainsnak: { datavalue?: { value: { id?: string; time?: string } } };
  qualifiers?: Record<string, { datavalue?: { value: { time?: string } } }[]>;
}

/**
 * Wikipedia articles (sk, and hu for the southern districts) whose title is the candidate's exact
 * name. An article links only when Wikidata's birth date gives the candidate's age (±1), or, when
 * Wikidata has no birth date, the article's intro names the candidate's municipality.
 */
export async function wikipedia(): Promise<Stats> {
  const source = await sourceId("wikipedia");
  const persons = await db
    .selectFrom("person")
    .innerJoin("candidacy", "candidacy.person_id", "person.id")
    .innerJoin("race", "race.id", "candidacy.race_id")
    .leftJoin("municipality", "municipality.code", "race.municipality_code")
    .select([
      "person.id",
      "person.given_name",
      "person.family_name",
      "person.age_2026",
      sql<
        string | null
      >`coalesce(municipality.name, candidacy.residence_municipality)`.as(
        "place",
      ),
      "municipality.district_name",
    ])
    .where("race.election_code", "in", ["OSO2026", "VUC2026"])
    .execute();
  const people = new Map<
    string,
    {
      id: string;
      given: string;
      family: string;
      age: number;
      places: Set<string>;
      hungarian: boolean;
    }
  >();
  for (const p of persons) {
    const e = people.get(p.id) ?? {
      id: p.id,
      given: p.given_name,
      family: p.family_name,
      age: p.age_2026,
      places: new Set<string>(),
      hungarian: false,
    };
    if (p.place) e.places.add(normalise(p.place));
    if (p.district_name && HUNGARIAN_DISTRICTS.has(p.district_name))
      e.hungarian = true;
    people.set(p.id, e);
  }

  // Candidate titles per wiki.
  const lookups: { lang: "sk" | "hu"; title: string; personId: string }[] = [];
  for (const p of people.values()) {
    lookups.push({
      lang: "sk",
      title: `${p.given} ${p.family}`,
      personId: p.id,
    });
    if (p.hungarian)
      lookups.push({
        lang: "hu",
        title: `${p.family} ${p.given}`,
        personId: p.id,
      });
  }

  type Found = {
    lang: "sk" | "hu";
    personId: string;
    page: Page;
    snapshot: Snapshot;
  };
  const found: Found[] = [];
  for (const lang of ["sk", "hu"] as const) {
    const list = lookups.filter((l) => l.lang === lang);
    for (let i = 0; i < list.length; i += 50) {
      const batch = list.slice(i, i + 50);
      const url =
        `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2` +
        `&redirects=1&prop=pageprops|extracts&exintro=1&explaintext=1&exlimit=max` +
        `&titles=${encodeURIComponent(batch.map((b) => b.title).join("|"))}`;
      const snapshot = await fetchSnapshot("wikipedia", url);
      const data = JSON.parse(snapshot.bytes.toString("utf-8")) as {
        query?: {
          pages?: Page[];
          redirects?: { from: string; to: string }[];
          normalized?: { from: string; to: string }[];
        };
      };
      const alias = new Map<string, string>();
      for (const r of [
        ...(data.query?.normalized ?? []),
        ...(data.query?.redirects ?? []),
      ]) {
        alias.set(r.from, r.to);
      }
      for (const b of batch) {
        let t = b.title;
        for (let k = 0; k < 3 && alias.has(t); k++) t = alias.get(t)!;
        const page = data.query?.pages?.find((pg) => pg.title === t);
        if (
          !page ||
          page.missing !== undefined ||
          page.pageprops?.disambiguation !== undefined
        )
          continue;
        found.push({ lang, personId: b.personId, page, snapshot });
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // Wikidata for the found articles.
  const qids = [
    ...new Set(
      found.map((f) => f.page.pageprops?.wikibase_item).filter(Boolean),
    ),
  ] as string[];
  const entities = new Map<string, { claims: Record<string, Claim[]> }>();
  let wikidataSnapshot: Snapshot | null = null;
  for (let i = 0; i < qids.length; i += 50) {
    const url =
      `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims` +
      `&ids=${qids.slice(i, i + 50).join("|")}`;
    wikidataSnapshot = await fetchSnapshot("wikipedia", url);
    const data = JSON.parse(wikidataSnapshot.bytes.toString("utf-8")) as {
      entities: Record<string, { claims: Record<string, Claim[]> }>;
    };
    for (const [id, e] of Object.entries(data.entities)) entities.set(id, e);
  }
  // Labels for the referenced items (positions, parties, ...).
  const refIds = new Set<string>();
  for (const e of entities.values()) {
    for (const p of Object.keys(PROPS)) {
      for (const c of e.claims[p] ?? []) {
        const id = c.mainsnak.datavalue?.value.id;
        if (id) refIds.add(id);
      }
    }
  }
  const labels = new Map<string, string>();
  const ids = [...refIds];
  for (let i = 0; i < ids.length; i += 50) {
    const url =
      `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels` +
      `&languages=sk|hu|en&ids=${ids.slice(i, i + 50).join("|")}`;
    const snap = await fetchSnapshot("wikipedia", url);
    const data = JSON.parse(snap.bytes.toString("utf-8")) as {
      entities: Record<string, { labels?: Record<string, { value: string }> }>;
    };
    for (const [id, e] of Object.entries(data.entities)) {
      const l = e.labels?.sk ?? e.labels?.hu ?? e.labels?.en;
      if (l) labels.set(id, l.value);
    }
  }

  const year = (t?: string) => (t ? Number(t.slice(1, 5)) : null);
  const rows: {
    person_id: string;
    payload: Record<string, unknown>;
    snapshot: Snapshot;
    url: string;
    reason: Record<string, unknown>;
  }[] = [];
  let rejected = 0;
  for (const f of found) {
    const person = people.get(f.personId)!;
    const qid = f.page.pageprops?.wikibase_item ?? null;
    const claims = qid ? (entities.get(qid)?.claims ?? {}) : {};
    const born = year(claims.P569?.[0]?.mainsnak.datavalue?.value.time);
    const intro = f.page.extract ?? "";
    const placeInIntro = [...person.places].some((pl) =>
      normalise(intro).includes(pl),
    );
    const ageOk =
      born !== null && Math.abs(ELECTION_YEAR - born - person.age) <= 1;
    if (born !== null ? !ageOk : !placeInIntro) {
      rejected++;
      continue;
    }
    const facts: Record<
      string,
      { label: string; from: number | null; to: number | null }[]
    > = {};
    for (const [p, name] of Object.entries(PROPS)) {
      facts[name] = (claims[p] ?? [])
        .map((c) => ({
          label: labels.get(c.mainsnak.datavalue?.value.id ?? "") ?? "",
          from: year(c.qualifiers?.P580?.[0]?.datavalue?.value.time),
          to: year(c.qualifiers?.P582?.[0]?.datavalue?.value.time),
        }))
        .filter((x) => x.label);
    }
    const url = `https://${f.lang}.wikipedia.org/wiki/${encodeURIComponent(f.page.title.replace(/ /g, "_"))}`;
    rows.push({
      person_id: person.id,
      payload: {
        lang: f.lang,
        title: f.page.title,
        url,
        intro: intro.slice(0, 1200),
        wikidata: qid,
        ...facts,
        licence: "CC BY-SA 4.0 (Wikipédia), CC0 (Wikidata)",
      },
      snapshot: f.snapshot,
      url,
      reason:
        born !== null
          ? { matched: ["name", "age"], basis: "wikidata_birth_date" }
          : { matched: ["name", "municipality_in_article"] },
    });
  }

  await db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom("fact")
      .where("type", "=", "encyclopedia")
      .where("source_id", "=", source)
      .execute();
    for (const r of rows) {
      await trx
        .insertInto("fact")
        .values({
          person_id: r.person_id,
          type: "encyclopedia",
          payload: jsonb(r.payload),
          source_id: source,
          source_url: r.url,
          snapshot_id: r.snapshot.id,
          method: "scrape",
          match_reason: jsonb(r.reason),
        })
        .execute();
    }
  });

  return {
    titles_checked: lookups.length,
    articles_with_exact_title: found.length,
    linked: rows.length,
    rejected_as_namesakes: rejected,
    persons: new Set(rows.map((r) => r.person_id)).size,
    wikidata_items: qids.length,
  };
}
