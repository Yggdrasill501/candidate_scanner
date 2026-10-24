import { db, jsonb, sql } from "@repo/db";
import { normalise, stripTitles } from "../lib/names";
import { pdfText } from "../lib/pdf";
import { mapPool } from "../lib/pool";
import type { Stats } from "../lib/run";
import { fetchSnapshot } from "../lib/snapshot";
import { SOURCES, sourceId } from "../lib/sources";

const ORIGIN = "https://www.unsk.sk";
/** Income years of the 2022–2026 term (declarations filed 2023–2026). */
const YEARS = [2022, 2023, 2024, 2025];

/** Section labels in the NSK export, in document order. */
const LABELS = {
  function: "vykonávaná verejná funkcia:",
  income: "príjmy za rok",
  employment: "vykonávam nasledovné zamestnanie",
  business: "vykonávam nasledovnú podnikateľskú činnosť",
  functions: "počas výkonu verejnej funkcie mám tieto funkcie",
  realEstate: "vlastníctvo nehnuteľnej veci:",
  movables: "vlastníctvo hnuteľnej veci:",
  rights: "vlastníctvo majetkového práva alebo inej majetkovej hodnoty:",
  liabilities: "existencia záväzku:",
  useRealEstate: "užívanie nehnuteľnej veci",
  useMovables: "užívanie hnuteľnej veci",
  gifts: "prijaté dary alebo iné výhody:",
} as const;

/** Lines of one labelled section, up to the next known label. */
function section(lines: string[], label: string): string[] {
  const start = lines.findIndex((l) => l.startsWith(label));
  if (start < 0) return [];
  const labels = Object.values(LABELS) as string[];
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (labels.some((l) => line.startsWith(l))) break;
    out.push(line);
  }
  // Drop the legal reference lines that continue a label, e.g. "z. č. 357/2004 Z. z.):".
  return out.filter(
    (l) => l !== "" && !/Z\. ?z\.\)?:$/.test(l) && !/^z\.\):?$/.test(l),
  );
}

function euros(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Asset and interest declarations of NSK councillors for the current term. A declaration links
 * to a 2026 candidate who was elected to the NSK council in 2022 under the same name.
 */
export async function nskDeclarations(): Promise<Stats> {
  const source = await sourceId("nsk_declarations");
  const page = await fetchSnapshot(
    "nsk_declarations",
    SOURCES.nsk_declarations.base_url,
  );
  const html = page.bytes.toString("utf-8");

  const headings = [
    ...html.matchAll(/<(h[1-6]|strong)[^>]*>([\s\S]*?)<\/\1>/g),
  ].map((m) => ({
    pos: m.index!,
    text: m[2]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "),
  }));
  const links = [
    ...html.matchAll(/href="([^"]*Files\/ShowFile\/(\d+))"[^>]*>([^<]+)</g),
  ]
    .map((m) => {
      const heading = headings.filter((h) => h.pos < m.index!).at(-1);
      const year = Number(heading?.text.match(/za rok (\d{4})/)?.[1]);
      return {
        url: new URL(m[1]!, ORIGIN).toString(),
        label: m[3]!.trim(),
        year,
      };
    })
    .filter((l) => YEARS.includes(l.year) && !l.label.startsWith("Tlačivo"));

  // 2026 candidates who were elected to the NSK council in 2022, by normalised name.
  const members = await db
    .selectFrom("fact")
    .innerJoin("person", "person.id", "fact.person_id")
    .select(["person.id", "person.normalised_name"])
    .where("fact.type", "=", "past_candidacy")
    .where(sql<string>`fact.payload->>'election_code'`, "=", "VUC2022")
    .execute();
  const byName = new Map<string, string[]>();
  for (const m of members) {
    byName.set(m.normalised_name, [
      ...new Set([...(byName.get(m.normalised_name) ?? []), m.id]),
    ]);
  }

  // Municipalities each member runs in or lives in, to disambiguate namesakes from the text.
  const placeRows = await db
    .selectFrom("candidacy")
    .innerJoin("race", "race.id", "candidacy.race_id")
    .leftJoin("municipality", "municipality.code", "race.municipality_code")
    .select([
      "candidacy.person_id",
      "municipality.name",
      "candidacy.residence_municipality",
    ])
    .where("race.election_code", "in", ["OSO2026", "VUC2026"])
    .execute();
  const placesOf = new Map<string, Set<string>>();
  for (const r of placeRows) {
    if (!r.person_id) continue;
    const set = placesOf.get(r.person_id) ?? new Set<string>();
    for (const n of [r.name, r.residence_municipality])
      if (n) set.add(normalise(n));
    placesOf.set(r.person_id, set);
  }

  type Row = {
    person_id: string;
    payload: Record<string, unknown>;
    year: number;
    url: string;
    snapshot_id: string;
    namesakes: number;
    byText: boolean;
  };
  const rows: Row[] = [];
  let unmatched = 0;
  let notCandidates = 0;
  await mapPool(links, 3, 200, async (link) => {
    const name = normalise(stripTitles(link.label));
    const persons = byName.get(name);
    if (!persons) {
      notCandidates++;
      return;
    }
    const snap = await fetchSnapshot("nsk_declarations", link.url);
    const lines = (await pdfText(snap.bytes)).split("\n").map((l) => l.trim());
    if (!lines.some((l) => l.startsWith("oznámenie za rok"))) {
      unmatched++;
      return;
    }
    const income = section(lines, LABELS.income).join(" ");
    const incomePublic = income.match(
      /([\d\s]+,\d{2}) € \(z výkonu verejnej funkcie\)/,
    )?.[1];
    const incomeOther = income.match(/([\d\s]+,\d{2}) € \(iné\)/)?.[1];
    const payload = {
      year: link.year,
      declared_name: link.label,
      public_function: section(lines, LABELS.function).join(" ") || null,
      income_public_function_eur: euros(incomePublic),
      income_other_eur: euros(incomeOther),
      employment: section(lines, LABELS.employment).filter(
        (l) => !l.startsWith("Dlhodobo"),
      ),
      business: section(lines, LABELS.business),
      functions: section(lines, LABELS.functions).filter(
        (l) => !l.startsWith("požitky"),
      ),
      // Real estate without land-register (LV) numbers; the source PDF keeps the full record.
      real_estate: section(lines, LABELS.realEstate).map((l) =>
        l.replace(/; číslo LV: \d+/, ""),
      ),
      movables: section(lines, LABELS.movables),
      property_rights: section(lines, LABELS.rights),
      liabilities: section(lines, LABELS.liabilities),
      gifts: section(lines, LABELS.gifts),
    };
    // Namesakes: keep only the candidate whose municipality the declaration names, if exactly one.
    let linkedTo = persons;
    let byText = false;
    if (persons.length > 1) {
      const text = normalise(lines.join(" "));
      const named = persons.filter((id) =>
        [...(placesOf.get(id) ?? [])].some((place) => text.includes(place)),
      );
      if (named.length === 1) {
        linkedTo = named;
        byText = true;
      }
    }
    for (const id of linkedTo) {
      rows.push({
        person_id: id,
        payload,
        year: link.year,
        url: link.url,
        snapshot_id: snap.id,
        namesakes: persons.length,
        byText,
      });
    }
  });

  await db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom("fact")
      .where("type", "=", "asset_declaration")
      .where("source_id", "=", source)
      .execute();
    for (const r of rows) {
      await trx
        .insertInto("fact")
        .values({
          person_id: r.person_id,
          type: "asset_declaration",
          payload: jsonb(r.payload),
          occurred_from: `${r.year}-01-01`,
          occurred_to: `${r.year}-12-31`,
          source_id: source,
          source_url: r.url,
          snapshot_id: r.snapshot_id,
          method: "register",
          match_reason: jsonb({
            matched: r.byText
              ? ["name", "body_member", "municipality_in_document"]
              : ["name", "body_member"],
            body: "Zastupiteľstvo NSK 2022–2026",
            namesakes: r.namesakes,
            ...(r.namesakes > 1 && !r.byText ? { ambiguous: r.namesakes } : {}),
          }),
        })
        .execute();
    }
  });

  return {
    links_in_term: links.length,
    declarations_linked: rows.length,
    persons: new Set(rows.map((r) => r.person_id)).size,
    declarants_not_running_2026: notCandidates,
    unparsed: unmatched,
  };
}
