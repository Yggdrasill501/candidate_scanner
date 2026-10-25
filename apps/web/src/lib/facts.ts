// How facts read on the page: labels for match reasons, one-line descriptions per fact type,
// the profile section each type belongs to, and the template summary used where no AI summary
// exists. Data values stay verbatim; only the surrounding words are translated.
import type { Candidacy2026, Fact, MatchReason, SummarySentence } from "./data";
import { formatDate, formatNumber, t, yearOf, type Lang } from "./i18n";

export type Section =
  "history" | "business" | "assets" | "campaign" | "media" | "votes";

export const SECTION_OF: Record<string, Section> = {
  past_candidacy: "history",
  business_role: "business",
  ngo_role: "business",
  asset_declaration: "assets",
  campaign_account: "campaign",
  watchdog_evaluation: "campaign",
  media_mention: "media",
  fact_check: "media",
  encyclopedia: "media",
  attendance: "votes",
};

/** Sources each section is collected from for every candidate, for "Nenájdené v: …". */
export const SECTION_SOURCES: Record<Section, string[]> = {
  history: ["statistics_results"],
  business: ["rpo", "rpvs", "rmno"],
  assets: ["nsk_declarations", "tis"],
  campaign: ["tis"],
  media: ["google_news", "demagog", "wikipedia"],
  votes: ["nitra_votes"],
};

const MATCH_LABEL: Record<Lang, Record<string, string>> = {
  sk: {
    name: "meno",
    municipality: "obec",
    age: "vek",
    party: "strana",
    race: "voľba",
    body_member: "člen zastupiteľstva",
    term: "volebné obdobie",
    municipality_in_document: "obec v dokumente",
    municipality_in_article: "obec v článku",
    name_phrase: "celé meno v texte",
    occupation_member_of_parliament: "funkcia poslanca NR SR",
    source_record: "záznam zdroja",
    birth_date_in_register: "dátum narodenia v registri",
    wikidata_birth_date: "dátum narodenia vo Wikidata",
  },
  en: {
    name: "name",
    municipality: "municipality",
    age: "age",
    party: "party",
    race: "race",
    body_member: "council member",
    term: "term",
    municipality_in_document: "municipality in document",
    municipality_in_article: "municipality in article",
    name_phrase: "full name in text",
    occupation_member_of_parliament: "member of parliament",
    source_record: "source record",
    birth_date_in_register: "birth date in register",
    wikidata_birth_date: "birth date in Wikidata",
  },
  hu: {
    name: "név",
    municipality: "település",
    age: "kor",
    party: "párt",
    race: "választás",
    body_member: "testületi tag",
    term: "választási időszak",
    municipality_in_document: "település a dokumentumban",
    municipality_in_article: "település a cikkben",
    name_phrase: "teljes név a szövegben",
    occupation_member_of_parliament: "parlamenti képviselő",
    source_record: "forrásrekord",
    birth_date_in_register: "születési dátum a nyilvántartásban",
    wikidata_birth_date: "születési dátum a Wikidatában",
  },
};

export interface MatchChip {
  label: string;
  kind: "yes" | "no" | "na" | "amb";
}

export function matchChips(lang: Lang, m: MatchReason): MatchChip[] {
  const L = MATCH_LABEL[lang];
  const d = t(lang).profile;
  const chips: MatchChip[] = [];
  for (const k of m.matched ?? [])
    chips.push({ label: L[k] ?? k, kind: "yes" });
  if (m.basis) chips.push({ label: L[m.basis] ?? m.basis, kind: "yes" });
  for (const k of m.mismatched ?? [])
    chips.push({ label: L[k] ?? k, kind: "no" });
  for (const k of m.unavailable ?? [])
    chips.push({ label: L[k] ?? k, kind: "na" });
  if (m.ambiguous && m.ambiguous > 1)
    chips.push({ label: d.ambiguous(m.ambiguous), kind: "amb" });
  else if (m.namesakes && m.namesakes > 1)
    chips.push({ label: d.namesakes(m.namesakes), kind: "amb" });
  return chips;
}

/** A name-only link needs a visible match reason; candidacies from the MV SR list do not. */
export function needsMatchReason(m: MatchReason): boolean {
  return !(m.matched?.length === 1 && m.matched[0] === "source_record");
}

const s = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v);

export function period(
  lang: Lang,
  f: Pick<Fact, "from" | "to">,
  open = false,
): string {
  const from = yearOf(f.from);
  const to = yearOf(f.to);
  if (!from && !to) return "";
  if (open && !f.to) return `${from} – ${t(lang).profile.current}`;
  if (from && to && from !== to) return `${from} – ${to}`;
  return String(from ?? to);
}

export interface FactText {
  title: string;
  detail?: string;
  when: string;
}

/** The one-line reading of a fact, used in sections and on the timeline. */
export function describe(lang: Lang, f: Fact): FactText {
  const d = t(lang);
  const p = f.payload;
  switch (f.type) {
    case "past_candidacy": {
      const kind = s(p.race_kind) as keyof typeof d.race.kind;
      const place = s(p.municipality_name) || "NSK";
      const result = p.elected ? d.profile.elected : d.profile.notElected;
      const votes =
        typeof p.votes === "number"
          ? `, ${d.profile.votes(formatNumber(lang, p.votes))}`
          : "";
      return {
        title: `${d.race.kind[kind] ?? kind} · ${place}`,
        detail: `${result}${votes}${p.party ? ` · ${s(p.party)}` : ""}`,
        when: String(yearOf(f.from) ?? ""),
      };
    }
    case "business_role": {
      const role =
        s(p.role_label) ||
        (p.role === "beneficial_owner"
          ? "konečný užívateľ výhod (RPVS)"
          : s(p.role));
      return {
        title: `${role}, ${s(p.organisation)}`,
        detail: [
          p.ico ? `IČO ${s(p.ico)}` : "",
          s(p.address_municipality),
          p.organisation_terminated ? d.profile.terminated : "",
        ]
          .filter(Boolean)
          .join(" · "),
        when: period(lang, f, true),
      };
    }
    case "ngo_role":
      return {
        title: `${s(p.function) || s(p.role)}, ${s(p.organisation)}`,
        detail: [p.ico ? `IČO ${s(p.ico)}` : "", s(p.legal_form)]
          .filter(Boolean)
          .join(" · "),
        when: period(lang, f, true),
      };
    case "asset_declaration": {
      const parts = [
        p.public_function
          ? `${d.profile.publicFunction}: ${s(p.public_function)}`
          : "",
        typeof p.income_public_function_eur === "number"
          ? `${d.profile.income}: ${formatNumber(lang, p.income_public_function_eur)} €`
          : "",
        typeof p.income_other_eur === "number"
          ? `${d.profile.otherIncome}: ${formatNumber(lang, p.income_other_eur)} €`
          : "",
        Array.isArray(p.real_estate)
          ? `${d.profile.realEstate}: ${p.real_estate.length}`
          : "",
      ];
      return {
        title: `${d.profile.sections.assets} ${s(p.year)}`,
        detail: parts.filter(Boolean).join(" · "),
        when: s(p.year),
      };
    }
    case "campaign_account":
      return {
        title: p.transparent_account ? d.profile.transparent : d.profile.web,
        detail: [s(p.transparent_account), s(p.web)]
          .filter(Boolean)
          .join(" · "),
        when: "",
      };
    case "watchdog_evaluation":
      return {
        title: `${d.profile.score}: ${s(p.set)}`,
        detail: `${s(p.score)} / 100 · ${s(p.evaluator)}`,
        when: formatDate(s(p.evaluated_on) || null),
      };
    case "media_mention":
      return {
        title: s(p.title),
        detail: s(p.outlet),
        when: formatDate(f.from),
      };
    case "fact_check":
      return {
        title: `${d.profile.rating}: ${s(p.rating)}`,
        detail: s(p.quote),
        when: formatDate(f.from),
      };
    case "encyclopedia":
      return { title: s(p.title), detail: s(p.intro), when: "" };
    case "attendance": {
      const total = Number(p.total_votes) || 0;
      const present = Number(p.present_votes) || 0;
      const pct = total
        ? ((present / total) * 100)
            .toFixed(1)
            .replace(".", lang === "en" ? "." : ",")
        : "0";
      return {
        title: d.profile.attendance(pct, present, total),
        when: period(lang, f, true),
      };
    }
    default:
      return { title: f.type, when: formatDate(f.from) };
  }
}

/** Outbound research links, built from the name and municipality, never fetched by us. */
export function researchLinks(name: string, place: string | null) {
  const q = encodeURIComponent(name);
  const qp = encodeURIComponent(place ? `"${name}" ${place}` : `"${name}"`);
  return [
    {
      target: "orsr",
      label: "ORSR",
      sub: "Obchodný register",
      href: `https://www.orsr.sk/hladaj_osoba.asp?PR=${encodeURIComponent(name.split(" ").slice(-1)[0] ?? "")}&MENO=${encodeURIComponent(name.split(" ")[0] ?? "")}&SID=0&T=f0&R=on`,
    },
    {
      target: "finstat",
      label: "Finstat",
      sub: "finstat.sk",
      href: `https://finstat.sk/databaza-osob?query=${q}`,
    },
    {
      target: "rpvs",
      label: "RPVS",
      sub: "Register partnerov verejného sektora",
      href: `https://rpvs.gov.sk/rpvs/Partner/Partner/VyhladavaniePartnera`,
    },
    {
      target: "crz",
      label: "CRZ",
      sub: "Centrálny register zmlúv",
      href: `https://www.crz.gov.sk/?s=${q}`,
    },
    {
      target: "google_news",
      label: "Google News",
      sub: "news.google.com",
      href: `https://news.google.com/search?q=${qp}&hl=sk&gl=SK&ceid=SK:sk`,
    },
    {
      target: "facebook",
      label: "Facebook",
      sub: "facebook.com",
      href: `https://www.facebook.com/search/top?q=${qp}`,
    },
  ];
}

/**
 * The fixed, non-AI summary of the spec ("Kandiduje v: … Volebná história: … Firmy: …"),
 * used where the pipeline has not stored a summary. Each sentence cites what it is built from.
 */
export function templateSummary(
  lang: Lang,
  candidacies: Candidacy2026[],
  facts: Fact[],
): SummarySentence[] {
  const d = t(lang);
  const out: SummarySentence[] = [];
  const word = {
    sk: {
      runs: "Kandiduje v 2026",
      hist: "Volebná história",
      firms: "Registre uvádzajú",
      roles: "rolí v organizáciách",
      none: "žiadne záznamy",
    },
    en: {
      runs: "Running in 2026",
      hist: "Election history",
      firms: "Registers list",
      roles: "roles in organisations",
      none: "no records",
    },
    hu: {
      runs: "Jelöltség 2026-ban",
      hist: "Választási előzmények",
      firms: "A nyilvántartások szerint",
      roles: "tisztség szervezetekben",
      none: "nincs adat",
    },
  }[lang];
  if (candidacies.length) {
    out.push({
      text: `${word.runs}: ${candidacies
        .map((c) => {
          const where = c.race.municipality ?? "NSK";
          const district =
            c.race.district && c.race.kind !== "mayor"
              ? `, ${d.race.district(c.race.district)}`
              : "";
          return `${d.race.kindShort[c.race.kind]} (${where}${district}), ${c.party ?? ""}`.replace(
            /, $/,
            "",
          );
        })
        .join("; ")}.`,
      fact_ids: [],
      candidacy_ids: candidacies.map((c) => c.id),
    });
  }
  const past = facts.filter((f) => f.type === "past_candidacy");
  if (past.length) {
    out.push({
      text: `${word.hist}: ${past
        .map((f) => {
          const p = f.payload;
          const kind = s(p.race_kind) as keyof typeof d.race.kindShort;
          return `${yearOf(f.from)} ${d.race.kindShort[kind] ?? kind} (${s(p.municipality_name) || "NSK"}) – ${p.elected ? d.profile.elected : d.profile.notElected}`;
        })
        .join("; ")}.`,
      fact_ids: past.map((f) => f.id),
      candidacy_ids: [],
    });
  }
  const roles = facts.filter(
    (f) => f.type === "business_role" || f.type === "ngo_role",
  );
  if (roles.length) {
    const orgs = new Set(roles.map((f) => s(f.payload.organisation)));
    out.push({
      text: `${word.firms}: ${roles.length} ${word.roles} (${orgs.size}).`,
      fact_ids: roles.map((f) => f.id),
      candidacy_ids: [],
    });
  }
  return out;
}
