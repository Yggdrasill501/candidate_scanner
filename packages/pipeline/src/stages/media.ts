import { db, jsonb, sql } from "@repo/db";
import { normalise } from "../lib/names";
import { mapPool } from "../lib/pool";
import type { Stats } from "../lib/run";
import { fetchSnapshot, type Snapshot } from "../lib/snapshot";
import { sourceId } from "../lib/sources";

const RSS = "https://news.google.com/rss/search";
/** Districts with a large Hungarian-speaking population: also search the Hungarian edition. */
const HUNGARIAN_DISTRICTS = new Set(["Komárno", "Nové Zámky", "Levice"]);
const RACE_PRIORITY: Record<string, number> = {
  regional_governor: 0,
  mayor: 1,
  regional_council: 2,
  municipal_council: 3,
};

interface Item {
  title: string;
  link: string;
  published: string | null;
  outlet: string | null;
  outletUrl: string | null;
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function parseRss(xml: string): Item[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const body = m[1]!;
    const tag = (t: string) =>
      body.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1];
    const source = body.match(/<source url="([^"]*)">([\s\S]*?)<\/source>/);
    const pub = tag("pubDate");
    return {
      title: decode(tag("title") ?? ""),
      link: decode(tag("link") ?? ""),
      published: pub ? new Date(pub).toISOString().slice(0, 10) : null,
      outlet: source ? decode(source[2]!) : null,
      outletUrl: source?.[1] ?? null,
    };
  });
}

/**
 * Media mentions from Google News: exact name phrase plus the candidate's municipality, so a
 * mention means the article contains both. Stores headline, outlet, date and link only.
 * Syndicated copies (same headline) are collapsed to the earliest.
 */
export async function media(): Promise<Stats> {
  const source = await sourceId("google_news");
  const persons = await db
    .selectFrom("person")
    .innerJoin("candidacy", "candidacy.person_id", "person.id")
    .innerJoin("race", "race.id", "candidacy.race_id")
    .leftJoin("municipality", "municipality.code", "race.municipality_code")
    .select([
      "person.id",
      "person.given_name",
      "person.family_name",
      "race.kind",
      sql<
        string | null
      >`coalesce(municipality.name, candidacy.residence_municipality)`.as(
        "place",
      ),
      "municipality.district_name",
    ])
    .where("race.election_code", "in", ["OSO2026", "VUC2026"])
    .$if(!!process.env.PIPELINE_ONLY, (q) =>
      q.where(
        "person.family_name",
        "in",
        process.env.PIPELINE_ONLY!.split(","),
      ),
    )
    .execute();

  // One query set per person, using their highest-priority race for the place.
  const byPerson = new Map<string, (typeof persons)[number]>();
  for (const p of persons) {
    const cur = byPerson.get(p.id);
    if (!cur || RACE_PRIORITY[p.kind]! < RACE_PRIORITY[cur.kind]!)
      byPerson.set(p.id, p);
  }
  const queue = [...byPerson.values()].sort(
    (a, b) => RACE_PRIORITY[a.kind]! - RACE_PRIORITY[b.kind]!,
  );

  const districtOf = new Map(
    (
      await db
        .selectFrom("municipality")
        .select(["name", "district_name"])
        .execute()
    ).map((m) => [normalise(m.name), m.district_name]),
  );

  type Row = {
    person_id: string;
    item: Item;
    query: string;
    snapshot: Snapshot;
  };
  const rows: Row[] = [];
  let failed = 0;
  let capped = 0;

  await mapPool(queue, 1, 1500, async (p) => {
    const place = p.place ?? "";
    const district = p.district_name ?? districtOf.get(normalise(place)) ?? "";
    const queries = [
      {
        q: `"${p.given_name} ${p.family_name}" "${place}"`,
        params: "hl=sk&gl=SK&ceid=SK:sk",
      },
    ];
    if (HUNGARIAN_DISTRICTS.has(district)) {
      queries.push({
        q: `"${p.family_name} ${p.given_name}" "${place}"`,
        params: "hl=hu&gl=HU&ceid=HU:hu",
      });
    }
    for (const { q, params } of queries) {
      try {
        const snapshot = await fetchSnapshot(
          "google_news",
          `${RSS}?q=${encodeURIComponent(q)}&${params}`,
        );
        const items = parseRss(snapshot.bytes.toString("utf-8"));
        if (items.length >= 100) capped++;
        for (const item of items) {
          // Election list/result pages name every candidate of a municipality; they say nothing
          // about this person unless the headline names them.
          const headline = normalise(item.title);
          if (
            !headline.includes(normalise(p.family_name)) &&
            /kandidat|vysledky|volby 20\d\d|valasztas|jeloltek/.test(headline)
          )
            continue;
          rows.push({ person_id: p.id, item, query: q, snapshot });
        }
      } catch {
        failed++;
      }
    }
  });

  // Collapse syndicated copies: same person + normalised headline, keep the earliest.
  const best = new Map<string, Row>();
  for (const r of rows) {
    const headline = normalise(r.item.title.replace(/\s+-\s+[^-]+$/, ""));
    const key = `${r.person_id}|${headline}`;
    const cur = best.get(key);
    if (!cur || (r.item.published ?? "9999") < (cur.item.published ?? "9999"))
      best.set(key, r);
  }
  const unique = [...best.values()];

  await db.transaction().execute(async (trx) => {
    let del = trx
      .deleteFrom("fact")
      .where("type", "=", "media_mention")
      .where("source_id", "=", source);
    if (process.env.PIPELINE_ONLY)
      del = del.where("person_id", "in", [...byPerson.keys()]);
    await del.execute();
    for (let i = 0; i < unique.length; i += 500) {
      await trx
        .insertInto("fact")
        .values(
          unique.slice(i, i + 500).map((r) => ({
            person_id: r.person_id,
            type: "media_mention",
            payload: jsonb({
              title: r.item.title,
              outlet: r.item.outlet,
              outlet_url: r.item.outletUrl,
              link: r.item.link,
              query: r.query,
            }),
            occurred_from: r.item.published,
            source_id: source,
            source_url: r.snapshot.url,
            snapshot_id: r.snapshot.id,
            method: "scrape" as const,
            match_reason: jsonb({
              matched: ["name_phrase", "municipality_in_article"],
            }),
          })),
        )
        .execute();
    }
  });

  return {
    persons: byPerson.size,
    mentions_raw: rows.length,
    mentions_after_dedup: unique.length,
    persons_with_mentions: new Set(unique.map((r) => r.person_id)).size,
    queries_capped_at_100: capped,
    failed_queries: failed,
  };
}
