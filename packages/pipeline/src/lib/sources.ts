import { db } from "@repo/db";

export const SOURCES = {
  minv_candidates: {
    name: "MV SR – zoznamy zaregistrovaných kandidátov",
    base_url: "https://www.minv.sk/?samosprava26-info10",
    kind: "primary",
  },
  rpvs: {
    name: "Register partnerov verejného sektora (MS SR)",
    base_url: "https://rpvs.gov.sk/opendatav2",
    kind: "primary",
  },
  nsk_declarations: {
    name: "NSK – oznámenia funkcií, zamestnaní, činností a majetkových pomerov",
    base_url:
      "https://www.unsk.sk/zobraz/sekciu/oznamenie-funkcii-zamestnani-cinnosti-a-majetkovych-pomerov-verejnych-funkciona",
    kind: "primary",
  },
  rmno: {
    name: "Register mimovládnych neziskových organizácií (MV SR)",
    base_url: "https://ives.minv.sk/rmno",
    kind: "primary",
  },
  nitra_votes: {
    name: "Mesto Nitra – hlasovania mestského zastupiteľstva",
    base_url: "https://nitra.sk/wp-json/wp/v2/media?search=Hlasovania",
    kind: "primary",
  },
  google_news: {
    name: "Google News (vyhľadávanie podľa mena)",
    base_url: "https://news.google.com/rss/search",
    kind: "secondary",
  },
  wikipedia: {
    name: "Wikipédia / Wikidata (CC BY-SA 4.0, CC0)",
    base_url: "https://sk.wikipedia.org",
    kind: "secondary",
  },
  demagog: {
    name: "Demagog.sk – overovanie výrokov politikov",
    base_url: "https://demagog.sk",
    kind: "secondary",
  },
  tis: {
    name: "Transparency International Slovensko – monitoring volieb 2026",
    base_url: "https://volby.transparency.sk/samosprava2026",
    kind: "secondary",
  },
  rpo: {
    name: "Register právnických osôb (ŠÚ SR), cez Slovensko.Digital datahub",
    base_url: "https://api.statistics.sk/rpo/v1",
    kind: "primary",
  },
  statistics_results: {
    name: "ŠÚ SR – výsledky volieb (archív Wayback Machine)",
    base_url: "https://volby.statistics.sk/",
    kind: "primary",
  },
} as const;

export interface SourceMeta {
  name: string;
  base_url: string;
  kind: "primary" | "secondary";
}

/** Sources declared by stage files at load time (see registerSource). */
const extra = new Map<string, SourceMeta>();

/**
 * Declares a source from inside a stage file, so new stages need no edit to this file.
 * Call at module top level: `registerSource("votes_nsk", { ... })`.
 */
export function registerSource(code: string, meta: SourceMeta): string {
  extra.set(code, meta);
  return code;
}

export type SourceCode = keyof typeof SOURCES | (string & {});

function meta(code: string): SourceMeta {
  const s = (SOURCES as Record<string, SourceMeta>)[code] ?? extra.get(code);
  if (!s) throw new Error(`unknown source "${code}": declare it with registerSource()`);
  return s;
}

/** Upserts the source row and returns its id. */
export async function sourceId(code: SourceCode): Promise<string> {
  const s = meta(code);
  const row = await db
    .insertInto("source")
    .values({ code, name: s.name, base_url: s.base_url, kind: s.kind })
    .onConflict((oc) =>
      oc
        .column("code")
        .doUpdateSet({ name: s.name, base_url: s.base_url, kind: s.kind }),
    )
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}
