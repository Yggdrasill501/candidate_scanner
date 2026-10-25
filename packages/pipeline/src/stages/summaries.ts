import { createHash } from "node:crypto";
import { db, jsonb, sql } from "@repo/db";
import { claude } from "../lib/claude";
import { codex } from "../lib/codex";
import { mapPool } from "../lib/pool";
import type { Stats } from "../lib/run";

export const SUMMARY_PROMPT_VERSION = "summary-v3";
const BATCH = 8;
const LANGS = ["sk", "en", "hu"] as const;
type Lang = (typeof LANGS)[number];

export const SYSTEM = `You write short, strictly neutral summaries of public records about candidates in the
2026 Slovak municipal and regional elections. Rules:
- Use ONLY the items given for that person. No outside knowledge, no guesses, no inference.
- 3 to 5 sentences per language (fewer if there is little data). Plain statements of record.
- Every sentence must cite the ids of the items it uses in "refs".
- No evaluative or emotional words, no praise or criticism, no comparisons with other people, no
  speculation about motives or chances.
- Items marked "match": "ambiguous" or "name_only" must be qualified ("podľa zhody mena" /
  "according to a name match" / "névegyezés alapján").
- Do not mention birth dates or addresses. Do not translate party, organisation or office names;
  keep them as given.
- A "business_role" with "rpvs_note" is a registration in the Register of Public Sector Partners
  because of a management position in a public company: never call it ownership; say it is a
  registration as a beneficial owner (konečný užívateľ výhod) in RPVS.
- Years and counts must come from the item fields ("from_year", "to_year", "count"); never turn
  a date range into a single year.
- Never infer gender from a name. Slovak past-tense verbs and adjectives carry gender, so in Slovak
  do NOT use them with the person as subject ("bol zvolený", "bola zvolená", "je uvedený").
  Use noun phrases and impersonal forms instead, e.g. "Zvolenie za poslanca mestského
  zastupiteľstva v Nitre v roku 2022 (447 hlasov).", "V registroch: 11 rolí v 6 organizáciách.",
  "Funkcia: člen dozorného orgánu, Službyt Nitra, s.r.o.". Office names stay as given in items.
  English: use the person's name or "the candidate", never he/she. Hungarian has no gender.
- Slovak (sk), English (en) and Hungarian (hu) versions say the same thing.
Answer only with the requested JSON.`;

const RACE_SK: Record<string, string> = {
  mayor: "starosta / primátor",
  municipal_council: "poslanec obecného / mestského zastupiteľstva",
  regional_governor: "predseda Nitrianskeho samosprávneho kraja",
  regional_council: "poslanec zastupiteľstva Nitrianskeho samosprávneho kraja",
};

const ELECTION_LABEL: Record<string, string> = {
  OSO2022: "komunálne voľby 2022",
  OSO2018: "komunálne voľby 2018",
  VUC2022: "voľby do VÚC 2022",
  VUC2017: "voľby do VÚC 2017",
};

const ROLE_LABEL: Record<string, string> = {
  beneficial_owner: "konečný užívateľ výhod (RPVS)",
  public_sector_partner: "partner verejného sektora (RPVS)",
  statutory_body: "štatutárny orgán",
  stakeholder: "spoločník",
};

interface Ref {
  id: string;
  facts: string[];
  candidacies: string[];
  data: Record<string, unknown>;
}

type Sentence = { text: string; refs: string[] };
type SummaryOutput = {
  people: ({ person: string } & Record<Lang, Sentence[]>)[];
};

export interface PersonInput {
  personId: string;
  name: string;
  age: number;
  refs: Ref[];
  /** Only the 2026 candidacies: summarised by template, without AI. */
  sparse: boolean;
  hash: string;
}

/** A date column (pg returns Date) as "yyyy-mm-dd"; "" when missing. */
// pg parses DATE columns as local midnight, so read local components (toISOString can shift the day).
const isoDate = (d: unknown): string =>
  d instanceof Date
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    : d == null
      ? ""
      : String(d);

function match(reason: Record<string, unknown> | null): string {
  if (!reason) return "confirmed";
  if (reason.ambiguous) return "ambiguous";
  const matched = (reason.matched as string[] | undefined) ?? [];
  return matched.length <= 1 ? "name_only" : "confirmed";
}

export async function inputs(): Promise<PersonInput[]> {
  const people = await db
    .selectFrom("person")
    .select(["id", "given_name", "family_name", "age_2026"])
    .execute();
  const candidacies = await db
    .selectFrom("candidacy")
    .innerJoin("race", "race.id", "candidacy.race_id")
    .leftJoin("municipality", "municipality.code", "race.municipality_code")
    .leftJoin(
      "electoral_district",
      "electoral_district.id",
      "race.electoral_district_id",
    )
    .select([
      "candidacy.id",
      "candidacy.person_id",
      "candidacy.titles_before",
      "candidacy.titles_after",
      "candidacy.occupation",
      "candidacy.party_label",
      "race.kind",
      "municipality.name as municipality",
      "electoral_district.number as district",
    ])
    .where("race.election_code", "in", ["OSO2026", "VUC2026"])
    .execute();
  const facts = await db
    .selectFrom("fact")
    .select([
      "id",
      "person_id",
      "type",
      "payload",
      "occurred_from",
      "occurred_to",
      "match_reason",
    ])
    .where("type", "not in", ["council_vote", "watchdog_evaluation"])
    .execute();

  const byPerson = new Map<string, typeof facts>();
  for (const f of facts)
    byPerson.set(f.person_id, [...(byPerson.get(f.person_id) ?? []), f]);
  const candByPerson = new Map<string, typeof candidacies>();
  for (const c of candidacies) {
    if (c.person_id)
      candByPerson.set(c.person_id, [
        ...(candByPerson.get(c.person_id) ?? []),
        c,
      ]);
  }

  return people.map((p) => {
    const refs: Ref[] = [];
    let n = 0;
    const add = (
      data: Record<string, unknown>,
      factIds: string[] = [],
      candIds: string[] = [],
    ) =>
      refs.push({ id: `r${++n}`, facts: factIds, candidacies: candIds, data });

    for (const c of candByPerson.get(p.id) ?? []) {
      add(
        {
          kind: "candidacy_2026",
          race: RACE_SK[c.kind],
          municipality: c.municipality,
          district: c.district,
          party: c.party_label,
          occupation: c.occupation,
          titles:
            [c.titles_before, c.titles_after].filter(Boolean).join(", ") ||
            null,
        },
        [],
        [c.id],
      );
    }
    const fs = byPerson.get(p.id) ?? [];
    const pay = (f: (typeof fs)[number]) =>
      f.payload as Record<string, unknown>;
    const reason = (f: (typeof fs)[number]) =>
      f.match_reason as Record<string, unknown>;

    for (const f of fs
      .filter((f) => f.type === "past_candidacy")
      .sort((a, b) =>
        isoDate(a.occurred_from).localeCompare(isoDate(b.occurred_from)),
      )) {
      const d = pay(f);
      add(
        {
          kind: "past_candidacy",
          election: ELECTION_LABEL[String(d.election_code)] ?? d.election_code,
          race: RACE_SK[String(d.race_kind)],
          municipality: d.municipality_name,
          party: d.party,
          elected: d.elected,
          votes: d.votes,
          match: match(reason(f)),
        },
        [f.id],
      );
    }

    const roles = fs.filter((f) => f.type === "business_role");
    if (roles.length > 0) {
      const current = roles.filter(
        (f) => !f.occurred_to && !pay(f).organisation_terminated,
      );
      add(
        {
          kind: "business_roles_overview",
          total_roles: roles.length,
          current_roles: current.length,
          organisations: new Set(
            roles.map((f) => pay(f).ico ?? pay(f).organisation),
          ).size,
          any_ambiguous: roles.some((f) => match(reason(f)) !== "confirmed"),
        },
        roles.slice(0, 50).map((f) => f.id),
      );
      for (const f of current.slice(0, 5)) {
        const d = pay(f);
        add(
          {
            kind: "business_role",
            organisation: d.organisation,
            role: d.role_label ?? ROLE_LABEL[String(d.role)] ?? d.role,
            since: f.occurred_from,
            ...(d.role === "beneficial_owner" && d.public_official
              ? {
                  rpvs_note:
                    "registered in RPVS as beneficial owner due to a management position in a public company; not ownership",
                }
              : {}),
            match: match(reason(f)),
          },
          [f.id],
        );
      }
    }
    for (const f of fs.filter((f) => f.type === "ngo_role").slice(0, 5)) {
      const d = pay(f);
      add(
        {
          kind: "ngo_role",
          organisation: d.organisation,
          role: d.function ?? d.role,
          since: f.occurred_from,
        },
        [f.id],
      );
    }
    const declarations = fs
      .filter((f) => f.type === "asset_declaration" && pay(f).year)
      .sort((a, b) => Number(pay(b).year) - Number(pay(a).year));
    if (declarations[0]) {
      const d = pay(declarations[0]);
      add(
        {
          kind: "asset_declaration",
          year: d.year,
          public_function: d.public_function,
          income_public_function_eur: d.income_public_function_eur,
          income_other_eur: d.income_other_eur,
          match: match(reason(declarations[0])),
        },
        [declarations[0].id],
      );
    }
    for (const f of fs.filter((f) => f.type === "attendance")) {
      const d = pay(f);
      add(
        {
          kind: "council_attendance",
          body: "Mestské zastupiteľstvo Nitra",
          term_from: f.occurred_from,
          votes_present: d.present_votes,
          votes_total: d.total_votes,
        },
        [f.id],
      );
    }
    const checks = fs.filter((f) => f.type === "fact_check");
    if (checks.length) {
      const ratings: Record<string, number> = {};
      for (const f of checks)
        ratings[String(pay(f).rating)] =
          (ratings[String(pay(f).rating)] ?? 0) + 1;
      add(
        {
          kind: "demagog_fact_checks",
          count: checks.length,
          ratings,
          match: match(reason(checks[0]!)),
        },
        checks.map((f) => f.id),
      );
    }
    const media = fs.filter((f) => f.type === "media_mention");
    if (media.length) {
      const dates = media
        .map((f) => isoDate(f.occurred_from))
        .filter(Boolean)
        .sort();
      add(
        {
          kind: "media_mentions",
          count: media.length,
          from_year: dates[0]?.slice(0, 4),
          to_year: dates.at(-1)?.slice(0, 4),
        },
        media.slice(0, 50).map((f) => f.id),
      );
    }
    for (const f of fs.filter((f) => f.type === "encyclopedia")) {
      const d = pay(f);
      add(
        {
          kind: "wikipedia",
          lang: d.lang,
          intro: String(d.intro ?? "").slice(0, 600),
          positions: d.position_held,
          match: match(reason(f)),
        },
        [f.id],
      );
    }
    for (const f of fs.filter((f) => f.type === "campaign_account")) {
      add(
        {
          kind: "campaign_transparent_account",
          published: Boolean(pay(f).transparent_account),
        },
        [f.id],
      );
    }

    const sparse = refs.every((r) => r.data.kind === "candidacy_2026");
    const hash = createHash("sha256")
      .update(
        JSON.stringify({
          v: SUMMARY_PROMPT_VERSION,
          refs: refs.map((r) => r.data),
        }),
      )
      .digest("hex");
    return {
      personId: p.id,
      name: `${p.given_name} ${p.family_name}`,
      age: p.age_2026,
      refs,
      sparse,
      hash,
    };
  });
}

/**
 * Deterministic summary, no AI: one sentence per kind of record, numbers taken from the items.
 * Used for everyone when SUMMARY_MODE=template, for people with only their 2026 candidacy, and as
 * the fallback when an AI answer fails validation. No gendered grammar in any language.
 */
function template(
  p: PersonInput,
): Record<Lang, { text: string; refs: string[] }[]> {
  const of = (kind: string) => p.refs.filter((r) => r.data.kind === kind);
  const ids = (rs: Ref[]) => rs.map((r) => r.id);
  const out: Record<Lang, { text: string; refs: string[] }[]> = {
    sk: [],
    en: [],
    hu: [],
  };
  const say = (refs: Ref[], sk: string, en: string, hu: string) => {
    if (refs.length === 0) return;
    out.sk.push({ text: sk, refs: ids(refs) });
    out.en.push({ text: en, refs: ids(refs) });
    out.hu.push({ text: hu, refs: ids(refs) });
  };

  const cands = of("candidacy_2026");
  const race = (r: Ref) =>
    [
      r.data.race,
      r.data.municipality,
      r.data.district ? `obvod ${r.data.district}` : null,
    ]
      .filter(Boolean)
      .join(", ");
  const list = cands.map((r) => `${race(r)} (${r.data.party})`).join("; ");
  say(
    cands,
    `${p.name} (${p.age}) – kandidatúra 2026: ${list}.`,
    `${p.name} (${p.age}) – 2026 candidacy: ${list}.`,
    `${p.name} (${p.age}) – 2026-os jelöltség: ${list}.`,
  );

  const past = of("past_candidacy");
  if (past.length) {
    const won = past.filter((r) => r.data.elected === true);
    const years = [
      ...new Set(
        won
          .map((r) => String(r.data.election).match(/\d{4}/)?.[0])
          .filter(Boolean),
      ),
    ].join(", ");
    say(
      past,
      `Predchádzajúce kandidatúry (2018–2022): ${past.length}, z toho zvolenie: ${won.length}${years ? ` (${years})` : ""}.`,
      `Earlier candidacies (2018–2022): ${past.length}, elected: ${won.length}${years ? ` (${years})` : ""}.`,
      `Korábbi jelöltségek (2018–2022): ${past.length}, ebből megválasztva: ${won.length}${years ? ` (${years})` : ""}.`,
    );
  }
  const overview = of("business_roles_overview")[0];
  if (overview) {
    const d = overview.data;
    say(
      [overview],
      `Registre (RPO, RPVS): ${d.total_roles} záznamov o podnikaní alebo funkciách v ${d.organisations} subjektoch, z toho ${d.current_roles} aktuálnych.`,
      `Registers (RPO, RPVS): ${d.total_roles} business records or positions in ${d.organisations} entities, ${d.current_roles} of them current.`,
      `Nyilvántartások (RPO, RPVS): ${d.total_roles} vállalkozási bejegyzés vagy tisztség ${d.organisations} szervezetben, ebből ${d.current_roles} jelenlegi.`,
    );
  }
  const ngos = of("ngo_role");
  say(
    ngos,
    `Register mimovládnych organizácií: ${ngos.length} funkcií.`,
    `Register of non-governmental organisations: ${ngos.length} positions.`,
    `Civil szervezetek nyilvántartása: ${ngos.length} tisztség.`,
  );
  const decl = of("asset_declaration")[0];
  if (decl) {
    say(
      [decl],
      `Oznámenie verejného funkcionára za rok ${decl.data.year} je k dispozícii.`,
      `A public official's declaration for ${decl.data.year} is available.`,
      `Közfunkcionáriusi nyilatkozat ${decl.data.year}-re/-ra elérhető.`,
    );
  }
  for (const a of of("council_attendance")) {
    const d = a.data;
    const from = String(d.term_from).slice(0, 4);
    say(
      [a],
      `${d.body}, obdobie od ${from}: účasť na ${d.votes_present} z ${d.votes_total} hlasovaní.`,
      `${d.body}, term from ${from}: present at ${d.votes_present} of ${d.votes_total} votes.`,
      `${d.body}, ${from}-tól kezdődő ciklus: jelen ${d.votes_total} szavazásból ${d.votes_present} alkalommal.`,
    );
  }
  const media = of("media_mentions")[0];
  if (media) {
    const d = media.data;
    say(
      [media],
      `Mediálne zmienky: ${d.count} (${d.from_year}–${d.to_year}).`,
      `Media mentions: ${d.count} (${d.from_year}–${d.to_year}).`,
      `Médiaemlítések: ${d.count} (${d.from_year}–${d.to_year}).`,
    );
  }
  if (out.sk.length === 1) {
    say(
      cands,
      "V spracovaných zdrojoch nie sú k dispozícii ďalšie záznamy.",
      "The processed sources contain no further records.",
      "A feldolgozott forrásokban nincs további adat.",
    );
  }
  // Keep within the 5-sentence limit: candidacy first, then the most specific records.
  for (const l of LANGS) out[l] = out[l].slice(0, 5);
  return out;
}

const SK_GENDERED =
  /(?<!\p{L})(bol|bola|zvolen[ýá]|pôsobil[a]?|kandidoval[a]?|pracoval[a]?|získal[a]?|zastával[a]?|vykonával[a]?|hlasoval[a]?|zúčastnil[a]?)(?!\p{L})/iu;
const EN_GENDERED = /(?<!\p{L})(he|she|his|her|him)(?!\p{L})/iu;
const EVALUATIVE =
  /(?<!\p{L})(úspešn\p{L}*|významn\p{L}*|kontroverzn\p{L}*|bohat\p{L}*|rozsiahl\p{L}*|successful\p{L}*|notabl\p{L}*|prominent|controversial|extensive\p{L}*|impressive|sikeres\p{L}*|jelentős\p{L}*)(?!\p{L})/iu;
// Remarks about the data itself instead of the record, and item ids pasted into the text.
const META =
  /(?<!\p{L})(r\d+|nečitateľn\p{L}*|chýbaj\p{L}*|unreadable|missing|olvashatatlan\p{L}*|hiányz\p{L}*)(?!\p{L})/iu;
const QUALIFIER: Record<Lang, RegExp> = {
  sk: /zhod\p{L}* men/iu,
  en: /name match/iu,
  hu: /névegyezés/iu,
};

/** Why an AI answer for one person cannot be stored; empty when it passes. */
function problems(
  p: PersonInput,
  r: Record<Lang, Sentence[]> | undefined,
): string[] {
  if (!r) return ["missing"];
  const out: string[] = [];
  const byId = new Map(p.refs.map((x) => [x.id, x]));
  for (const l of LANGS) {
    const ss = r[l] ?? [];
    if (ss.length < 1 || ss.length > 5)
      out.push(`${l}: ${ss.length} sentences`);
    for (const s of ss) {
      if (
        !s.text.trim() ||
        !s.refs.length ||
        !s.refs.every((id) => byId.has(id))
      )
        out.push(`${l}: bad refs`);
      // Every number must come from the cited items (or the name/age line).
      const cited = JSON.stringify([
        p.name,
        p.age,
        ...s.refs.map((id) => byId.get(id)?.data),
      ]);
      for (const n of s.text.replace(/(\d) (\d{3})/g, "$1$2").match(/\d+/g) ??
        [])
        if (!cited.includes(n)) out.push(`${l}: number ${n}`);
      if (l === "sk" && SK_GENDERED.test(s.text)) out.push("sk: gendered");
      if (l === "en" && EN_GENDERED.test(s.text)) out.push("en: he/she");
      if (EVALUATIVE.test(s.text)) out.push(`${l}: evaluative`);
      if (META.test(s.text)) out.push(`${l}: meta`);
      const weak = s.refs.some((id) =>
        ["ambiguous", "name_only"].includes(String(byId.get(id)?.data.match)),
      );
      if (weak && !QUALIFIER[l].test(s.text))
        out.push(`${l}: unqualified name match`);
    }
  }
  if (new Set(LANGS.map((l) => r[l]?.length)).size > 1)
    out.push("languages differ");
  return out;
}

/**
 * Summaries per person in sk/en/hu (specs/koho-volim, AI Summary Rules). People with only their
 * 2026 candidacy get the fixed template. Others are written in batches by SUMMARY_ENGINE
 * ("codex", default, or "claude"); every answer is checked by problems(). A person failing the
 * check is retried once alone with the engine, then with Claude (at most SUMMARY_CLAUDE_MAX
 * people per run), and otherwise gets the template. Unchanged inputs already written by AI are
 * skipped, so a stopped run resumes. Several failed engine calls in a row stop the run (quota).
 */
export async function summaries(): Promise<Stats> {
  const all = await inputs();
  const existing = new Map(
    (
      await db
        .selectFrom("ai_summary")
        .select(["person_id", "input_hash", "method"])
        .where("lang", "=", "sk")
        .execute()
    ).map((r) => [r.person_id, r]),
  );
  const templateOnly = process.env.SUMMARY_MODE === "template";
  const only = process.env.PIPELINE_ONLY?.split(",");
  const upToDate = (p: PersonInput) => {
    const e = existing.get(p.personId);
    return (
      e?.input_hash === p.hash &&
      (e.method === "ai" || p.sparse || templateOnly)
    );
  };
  const todo = all
    .filter((p) => !only || only.some((n) => p.name.endsWith(` ${n}`)))
    .filter((p) => !upToDate(p));

  const store = async (
    p: PersonInput,
    method: "ai" | "template",
    model: string | null,
    out: Record<Lang, Sentence[]>,
  ) => {
    const byId = new Map(p.refs.map((r) => [r.id, r]));
    for (const lang of LANGS) {
      const sentences = out[lang].map((s) => ({
        text: s.text,
        fact_ids: [
          ...new Set(s.refs.flatMap((id) => byId.get(id)?.facts ?? [])),
        ],
        candidacy_ids: [
          ...new Set(s.refs.flatMap((id) => byId.get(id)?.candidacies ?? [])),
        ],
      }));
      const row = {
        sentences: jsonb(sentences),
        method,
        model,
        prompt_version: SUMMARY_PROMPT_VERSION,
        input_hash: p.hash,
      };
      await db
        .insertInto("ai_summary")
        .values({ person_id: p.personId, lang, ...row })
        .onConflict((oc) =>
          oc
            .columns(["person_id", "lang"])
            .doUpdateSet({ ...row, generated_at: sql`now()` }),
        )
        .execute();
    }
  };

  let templated = 0;
  for (const p of todo.filter((p) => p.sparse || templateOnly)) {
    // Keep an AI summary that is still current when only refreshing templates.
    if (
      templateOnly &&
      existing.get(p.personId)?.method === "ai" &&
      existing.get(p.personId)?.input_hash === p.hash
    )
      continue;
    await store(p, "template", null, template(p));
    templated++;
  }
  const rich = templateOnly
    ? []
    : todo
        .filter((p) => !p.sparse)
        .slice(
          0,
          process.env.PIPELINE_LIMIT
            ? Number(process.env.PIPELINE_LIMIT)
            : undefined,
        );

  // Strict schema (closed objects, all required) works for both Codex and Claude.
  const sentence = {
    type: "object",
    properties: {
      text: { type: "string" },
      refs: { type: "array", items: { type: "string" } },
    },
    required: ["text", "refs"],
    additionalProperties: false,
  };
  const block = { type: "array", items: sentence };
  const schema = {
    type: "object",
    properties: {
      people: {
        type: "array",
        items: {
          type: "object",
          properties: {
            person: { type: "string" },
            sk: block,
            en: block,
            hu: block,
          },
          required: ["person", "sk", "en", "hu"],
          additionalProperties: false,
        },
      },
    },
    required: ["people"],
    additionalProperties: false,
  };

  const engine = process.env.SUMMARY_ENGINE ?? "codex";
  const claudeModel = process.env.CLAUDE_MODEL ?? "sonnet";
  const engineModel =
    engine === "codex"
      ? `codex:${process.env.CODEX_MODEL ?? "default"}`
      : claudeModel;
  const ask = async (
    batch: PersonInput[],
    via: string,
  ): Promise<SummaryOutput | null> => {
    const prompt =
      "Write the summaries for these people. Each person's items have ids; cite them in refs only, never in the text.\n\n" +
      batch
        .map((p, i) =>
          JSON.stringify({
            person: `p${i + 1}`,
            name: p.name,
            age: p.age,
            items: p.refs.map((r) => ({ id: r.id, ...r.data })),
          }),
        )
        .join("\n");
    if (via === "codex") return codex<SummaryOutput>(SYSTEM, prompt, schema);
    const res = await claude<SummaryOutput>(
      SYSTEM,
      prompt,
      schema,
      claudeModel,
    );
    cost += res.costUsd;
    return res.output;
  };

  let ai = 0;
  let viaClaude = 0;
  let fallback = 0;
  let cost = 0;
  let failedInRow = 0;
  const claudeMax = Number(process.env.SUMMARY_CLAUDE_MAX ?? 100);
  const failures: Record<string, number> = {};
  const batches: PersonInput[][] = [];
  for (let i = 0; i < rich.length; i += BATCH)
    batches.push(rich.slice(i, i + BATCH));

  await mapPool(
    batches,
    Number(process.env.SUMMARY_CONCURRENCY ?? 3),
    0,
    async (batch, index) => {
      if (failedInRow >= 4) return; // Engine is out of quota or down: stop, resume later.
      let output: SummaryOutput | null = null;
      try {
        output = await ask(batch, engine);
        failedInRow = 0;
      } catch (error) {
        failedInRow++;
        console.error(`  batch ${index}: ${String(error).slice(0, 300)}`);
      }
      for (const [i, p] of batch.entries()) {
        let r = output?.people.find((x) => x.person === `p${i + 1}`);
        let issues = problems(p, r);
        let model = engineModel;
        if (issues.length && output) {
          // Retry the person alone with the engine, then with Claude.
          const single = await ask([p], engine).catch(() => null);
          r = single?.people[0];
          issues = problems(p, r);
          if (issues.length && engine === "codex" && viaClaude < claudeMax) {
            viaClaude++;
            const viaC = await ask([p], "claude").catch(() => null);
            r = viaC?.people[0];
            issues = problems(p, r);
            model = claudeModel;
          }
        }
        if (r && !issues.length) {
          await store(p, "ai", model, { sk: r.sk, en: r.en, hu: r.hu });
          ai++;
        } else if (output) {
          // Only an answered batch falls back to the template; an engine error leaves the person for the next run.
          for (const x of issues)
            failures[x.replace(/ \d+$/, "")] =
              (failures[x.replace(/ \d+$/, "")] ?? 0) + 1;
          await store(p, "template", null, template(p));
          fallback++;
        }
      }
      if ((index + 1) % 20 === 0)
        console.log(
          `  ${index + 1}/${batches.length} batches, ${ai} ai, ${fallback} template`,
        );
    },
  );

  return {
    persons: all.length,
    up_to_date: all.length - todo.length,
    template_sparse: templated,
    ai_written: ai,
    via_claude: viaClaude,
    template_fallback: fallback,
    not_reached: rich.length - ai - fallback,
    stopped_on_errors: failedInRow >= 4 ? "yes" : "no",
    failure_reasons: JSON.stringify(failures),
    claude_usage_usd: Number(cost.toFixed(2)),
  };
}
