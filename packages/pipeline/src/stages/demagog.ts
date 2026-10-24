import { db, jsonb } from "@repo/db";
import { normalise, slugify } from "../lib/names";
import { mapPool } from "../lib/pool";
import type { Stats } from "../lib/run";
import { fetchSnapshot, storeSnapshot } from "../lib/snapshot";
import { sourceId } from "../lib/sources";

const SITE = "https://demagog.sk";

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(
      /&([a-z]+)acute;/gi,
      (_, c: string) =>
        ({ a: "á", e: "é", i: "í", o: "ó", u: "ú", y: "ý" })[c.toLowerCase()] ??
        c,
    )
    .replace(/&scaron;/g, "š")
    .replace(/&Scaron;/g, "Š")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fact-checked statements from Demagog.sk. Politician pages are matched to candidates by exact
 * full name (the page slug); Demagog's own rating and justification are quoted, not changed.
 */
export async function demagog(): Promise<Stats> {
  const source = await sourceId("demagog");
  const sitemap = (
    await fetchSnapshot("demagog", `${SITE}/sitemap.xml`)
  ).bytes.toString("utf-8");
  const slugs = [
    ...sitemap.matchAll(/<loc>[^<]*\/politik\/([^<\/]+)<\/loc>/g),
  ].map((m) => m[1]!);

  const persons = await db
    .selectFrom("person")
    .innerJoin("candidacy", "candidacy.person_id", "person.id")
    .select([
      "person.id",
      "person.given_name",
      "person.family_name",
      "candidacy.party_label",
      "candidacy.occupation",
    ])
    .execute();
  const partiesOf = new Map<string, Set<string>>();
  const isMp = new Set<string>();
  for (const p of persons) {
    const words = partiesOf.get(p.id) ?? new Set<string>();
    for (const w of normalise(p.party_label ?? "").split(" ")) words.add(w);
    partiesOf.set(p.id, words);
    if (
      /poslan\w* (parlament|nr sr|narodnej rady)/.test(
        normalise(p.occupation ?? ""),
      )
    )
      isMp.add(p.id);
  }
  const bySlug = new Map<string, string[]>();
  for (const p of persons) {
    const s = slugify(`${p.given_name} ${p.family_name}`);
    if (!bySlug.get(s)?.includes(p.id))
      bySlug.set(s, [...(bySlug.get(s) ?? []), p.id]);
  }
  const matched = slugs.filter((s) => bySlug.has(s));

  type Row = {
    person_id: string;
    payload: Record<string, unknown>;
    date: string | null;
    url: string;
    snapshot_id: string;
    namesakes: number;
    party: boolean;
  };
  const rows: Row[] = [];
  await mapPool(matched, 1, 1000, async (slug) => {
    const page = (
      await fetchSnapshot("demagog", `${SITE}/politik/${slug}`)
    ).bytes.toString("utf-8");
    const politicianId = page.match(/id="id_politik" value="(\d+)"/)?.[1];
    if (!politicianId) return;
    const party = normalise(
      text(
        page.match(/<span class="politik-strana">([\s\S]*?)<\/span>/)?.[1] ??
          "",
      ),
    );
    // The page shows the first statements only; the site's own filter returns all of them.
    const listUrl = `${SITE}/php/filterPolitik.php?id_politik=${politicianId}`;
    const res = await fetch(`${SITE}/php/filterPolitik.php`, {
      method: "POST",
      headers: {
        "user-agent": "KohoVolim/0.1 (neutral candidate profiles)",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        id_politik: politicianId,
        hodnota: "",
        oblast: "",
        date_from: "",
        date_to: "",
      }),
    });
    const body = Buffer.from(await res.arrayBuffer());
    const snap = await storeSnapshot(
      "demagog",
      listUrl,
      body,
      res.status,
      res.headers.get("content-type"),
    );
    const [status, html] = JSON.parse(body.toString("utf-8")) as [
      string,
      string,
    ];
    if (status.trim() !== "SUCCESS") return;
    // A party on Demagog must agree with the candidate's; without one, the match is name-only.
    // Compare on the party's first word: Demagog writes "SMER-SD", ballots "Smer - sociálna demokracia".
    const partyWord = party.split(" ")[0] ?? "";
    const ids = bySlug
      .get(slug)!
      .filter((id) => !partyWord || partiesOf.get(id)!.has(partyWord));
    if (ids.length === 0) return;
    for (const block of html.split('class="vyroky-block').slice(1)) {
      const id = block.match(/href="\.\.\/vyrok\/(\d+)"/)?.[1];
      if (!id) continue;
      const quote = text(
        block.match(/<p class="mb-0 fw-medium">([\s\S]*?)<\/p>\s*<\/p>/)?.[1] ??
          "",
      );
      const rating =
        text(
          block.match(/vyrok-icon-text[^"]*">([\s\S]*?)<\/span>/)?.[1] ?? "",
        ) || null;
      const justification =
        text(
          block.match(/vyrok-txt-odv">\s*<p[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "",
        ) || null;
      // The list endpoint prints today's date; the statement page has the real one.
      const detail = (
        await fetchSnapshot("demagog", `${SITE}/vyrok/${id}`)
      ).bytes.toString("utf-8");
      const date = detail.match(
        /front-vyroky-relacia">\s*(\d{2})\.(\d{2})\.(\d{4})/,
      );
      const published = detail.match(
        /Dátum zverejnenia analýzy:\s*(\d{2})\.(\d{2})\.(\d{4})/,
      );
      await new Promise((r) => setTimeout(r, 500));
      for (const person_id of ids) {
        rows.push({
          person_id,
          payload: {
            quote,
            rating,
            justification_excerpt: justification,
            demagog_id: id,
            politician_page: `${SITE}/politik/${slug}`,
            demagog_party: party || null,
            analysis_published: published
              ? `${published[3]}-${published[2]}-${published[1]}`
              : null,
          },
          date: date ? `${date[3]}-${date[2]}-${date[1]}` : null,
          url: `${SITE}/vyrok/${id}`,
          snapshot_id: snap.id,
          namesakes: ids.length,
          party: !!party,
        });
      }
    }
  });

  await db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom("fact")
      .where("type", "=", "fact_check")
      .where("source_id", "=", source)
      .execute();
    for (const r of rows) {
      await trx
        .insertInto("fact")
        .values({
          person_id: r.person_id,
          type: "fact_check",
          payload: jsonb(r.payload),
          occurred_from: r.date,
          source_id: source,
          source_url: r.url,
          snapshot_id: r.snapshot_id,
          method: "scrape",
          match_reason: jsonb({
            matched: [
              "name",
              ...(r.party ? ["party"] : []),
              ...(isMp.has(r.person_id)
                ? ["occupation_member_of_parliament"]
                : []),
            ],
            unavailable: ["age", "municipality"],
            namesakes: r.namesakes,
            ...(r.namesakes > 1 ? { ambiguous: r.namesakes } : {}),
          }),
        })
        .execute();
    }
  });

  return {
    politicians_on_demagog: slugs.length,
    matched_to_candidates: matched.length,
    statements: rows.length,
    persons: new Set(rows.map((r) => r.person_id)).size,
  };
}
