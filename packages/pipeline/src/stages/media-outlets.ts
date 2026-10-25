import { db, jsonb, sql } from "@repo/db";
import { normalise } from "../lib/names";
import { mapPool } from "../lib/pool";
import type { Stats } from "../lib/run";
import { fetchSnapshot, type Snapshot } from "../lib/snapshot";
import { registerSource, sourceId } from "../lib/sources";

/**
 * News outlets whose robots.txt allows automated access to these search endpoints (checked
 * 2026-10-25). Google News is not used: its robots.txt disallows /rss/search.
 */
const OUTLETS = [
  {
    code: "media_tasr",
    name: "TASR (teraz.sk)",
    base: "https://www.teraz.sk",
    kind: "tasr",
  },
  {
    code: "media_stvr",
    name: "STVR Správy",
    base: "https://spravy.stvr.sk",
    kind: "wp",
  },
  { code: "media_sita", name: "SITA", base: "https://sita.sk", kind: "wp" },
  {
    code: "media_nitraden",
    name: "NitraDen (iDen)",
    base: "https://nitraden.iden.sk",
    kind: "wp",
  },
  {
    code: "media_tvnitricka",
    name: "TV Nitrička",
    base: "https://tvnitricka.sk",
    kind: "wp",
  },
  {
    code: "media_parameter",
    name: "Parameter.sk",
    base: "https://parameter.sk",
    kind: "wp",
  },
] as const;
for (const o of OUTLETS)
  registerSource(o.code, { name: o.name, base_url: o.base, kind: "secondary" });

const DISTRICT_TOWNS = new Set([
  "Nitra",
  "Nové Zámky",
  "Komárno",
  "Levice",
  "Topoľčany",
  "Šaľa",
  "Zlaté Moravce",
]);
const HUNGARIAN_DISTRICTS = new Set(["Komárno", "Nové Zámky", "Levice"]);

interface Article {
  title: string;
  url: string;
  date: string | null;
  text: string;
}

function strip(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;|&amp;|&quot;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function search(
  outlet: (typeof OUTLETS)[number],
  phrase: string,
): Promise<{ articles: Article[]; snapshot: Snapshot }> {
  const q = encodeURIComponent(`"${phrase}"`);
  if (outlet.kind === "tasr") {
    const snapshot = await fetchSnapshot(
      outlet.code,
      `${outlet.base}/api_rest.php?module=RestApi&method=search&q=${q}&page=1`,
    );
    const data = JSON.parse(snapshot.bytes.toString("utf-8")) as {
      items?: {
        url: string;
        title: string;
        annotation: string;
        time_created_ISO: string;
      }[];
    };
    return {
      snapshot,
      articles: (data.items ?? []).map((i) => ({
        title: i.title,
        url: new URL(i.url, outlet.base).toString(),
        date: i.time_created_ISO?.slice(0, 10) ?? null,
        text: `${i.title} ${i.annotation}`,
      })),
    };
  }
  const snapshot = await fetchSnapshot(
    outlet.code,
    `${outlet.base}/wp-json/wp/v2/posts?search=${q}&per_page=20&_fields=date,link,title,excerpt,content`,
  );
  const data = JSON.parse(snapshot.bytes.toString("utf-8")) as
    | {
        date: string;
        link: string;
        title: { rendered: string };
        excerpt: { rendered: string };
        content: { rendered: string };
      }[]
    | { code: string };
  if (!Array.isArray(data)) return { snapshot, articles: [] };
  return {
    snapshot,
    articles: data.map((p) => ({
      title: strip(p.title.rendered),
      url: p.link,
      date: p.date.slice(0, 10),
      text: `${strip(p.title.rendered)} ${strip(p.excerpt.rendered)} ${strip(p.content.rendered)}`,
    })),
  };
}

/**
 * Media mentions from outlets that permit automated search, for candidates in mayoral, regional
 * and district-town council races. A mention needs the exact full name and the candidate's
 * municipality (or district / region) in the same article. Headline, outlet, date and link only.
 */
export async function run(): Promise<Stats> {
  const rows = await db
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
    .execute();
  const people = new Map<
    string,
    {
      id: string;
      given: string;
      family: string;
      places: Set<string>;
      hungarian: boolean;
      inScope: boolean;
    }
  >();
  for (const r of rows) {
    const p = people.get(r.id) ?? {
      id: r.id,
      given: r.given_name,
      family: r.family_name,
      places: new Set<string>(),
      hungarian: false,
      inScope: false,
    };
    if (r.place) p.places.add(r.place);
    if (r.district_name) p.places.add(r.district_name);
    if (r.kind === "regional_council" || r.kind === "regional_governor")
      p.places.add("Nitriansk");
    if (r.district_name && HUNGARIAN_DISTRICTS.has(r.district_name))
      p.hungarian = true;
    if (
      r.kind !== "municipal_council" ||
      (r.place && DISTRICT_TOWNS.has(r.place))
    )
      p.inScope = true;
    people.set(r.id, p);
  }
  const scope = [...people.values()].filter((p) => p.inScope);

  type Hit = {
    person_id: string;
    outlet: (typeof OUTLETS)[number];
    article: Article;
    snapshot: Snapshot;
  };
  const hits: Hit[] = [];
  let failed = 0;
  // One polite queue per outlet, outlets in parallel.
  await Promise.all(
    OUTLETS.map((outlet) =>
      mapPool(
        scope.filter((p) => outlet.code !== "media_parameter" || p.hungarian),
        1,
        1000,
        async (p) => {
          const phrases = [
            `${p.given} ${p.family}`,
            ...(outlet.code === "media_parameter"
              ? [`${p.family} ${p.given}`]
              : []),
          ];
          for (const phrase of phrases) {
            try {
              const { articles, snapshot } = await search(outlet, phrase);
              for (const a of articles) {
                const text = normalise(a.text);
                if (!text.includes(normalise(phrase))) continue;
                if (![...p.places].some((pl) => text.includes(normalise(pl))))
                  continue;
                hits.push({ person_id: p.id, outlet, article: a, snapshot });
              }
            } catch {
              failed++;
            }
          }
        },
      ),
    ),
  );

  const seen = new Set<string>();
  const unique = hits.filter((h) => {
    const key = `${h.person_id}|${h.article.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const sourceIds = new Map<string, string>();
  for (const o of OUTLETS) sourceIds.set(o.code, await sourceId(o.code));
  await db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom("fact")
      .where("type", "=", "media_mention")
      .where("source_id", "in", [...sourceIds.values()])
      .execute();
    for (let i = 0; i < unique.length; i += 500) {
      await trx
        .insertInto("fact")
        .values(
          unique.slice(i, i + 500).map((h) => ({
            person_id: h.person_id,
            type: "media_mention",
            payload: jsonb({
              title: h.article.title,
              outlet: h.outlet.name,
              link: h.article.url,
            }),
            occurred_from: h.article.date,
            source_id: sourceIds.get(h.outlet.code)!,
            source_url: h.article.url,
            snapshot_id: h.snapshot.id,
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
    persons_searched: scope.length,
    mentions: unique.length,
    persons_with_mentions: new Set(unique.map((h) => h.person_id)).size,
    failed_queries: failed,
  };
}
