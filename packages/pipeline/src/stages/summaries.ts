import { createHash } from "node:crypto";
import { db, jsonb, sql } from "@repo/db";
import { claude } from "../lib/claude";
import { mapPool } from "../lib/pool";
import type { Stats } from "../lib/run";

export const SUMMARY_PROMPT_VERSION = "summary-v2";
const BATCH = 8;
const LANGS = ["sk", "en", "hu"] as const;
type Lang = (typeof LANGS)[number];

const SYSTEM = `You write short, strictly neutral summaries of public records about candidates in the
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
- Avoid gendered pronouns and do not infer gender from names. In Slovak and Hungarian prefer
  impersonal or name-based constructions ("Kandidatúra…", "Zvolenie…", "V registroch je…");
  use a gendered form only when the item itself gives it (e.g. occupation "ekonómka").
- Slovak (sk), English (en) and Hungarian (hu) versions say the same thing.
Answer only with the requested JSON.`;

const RACE_SK: Record<string, string> = {
  mayor: "starosta / primátor",
  municipal_council: "poslanec obecného / mestského zastupiteľstva",
  regional_governor: "predseda Nitrianskeho samosprávneho kraja",
  regional_council: "poslanec zastupiteľstva Nitrianskeho samosprávneho kraja",
};

interface Ref {
  id: string;
  facts: string[];
  candidacies: string[];
  data: Record<string, unknown>;
}

type Sentence = { text: string; refs: string[] };
type SummaryOutput = { people: ({ person: string } & Record<Lang, Sentence[]>)[] };

interface PersonInput {
  personId: string;
  name: string;
  age: number;
  refs: Ref[];
  /** Only the 2026 candidacies: summarised by template, without AI. */
  sparse: boolean;
  hash: string;
}

function match(reason: Record<string, unknown> | null): string {
  if (!reason) return "confirmed";
  if (reason.ambiguous) return "ambiguous";
  const matched = (reason.matched as string[] | undefined) ?? [];
  return matched.length <= 1 ? "name_only" : "confirmed";
}

async function inputs(): Promise<PersonInput[]> {
  const people = await db.selectFrom("person").select(["id", "given_name", "family_name", "age_2026"]).execute();
  const candidacies = await db
    .selectFrom("candidacy")
    .innerJoin("race", "race.id", "candidacy.race_id")
    .leftJoin("municipality", "municipality.code", "race.municipality_code")
    .leftJoin("electoral_district", "electoral_district.id", "race.electoral_district_id")
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
    .select(["id", "person_id", "type", "payload", "occurred_from", "occurred_to", "match_reason"])
    .where("type", "not in", ["council_vote", "watchdog_evaluation"])
    .execute();

  const byPerson = new Map<string, typeof facts>();
  for (const f of facts) byPerson.set(f.person_id, [...(byPerson.get(f.person_id) ?? []), f]);
  const candByPerson = new Map<string, typeof candidacies>();
  for (const c of candidacies) {
    if (c.person_id) candByPerson.set(c.person_id, [...(candByPerson.get(c.person_id) ?? []), c]);
  }

  return people.map((p) => {
    const refs: Ref[] = [];
    let n = 0;
    const add = (data: Record<string, unknown>, factIds: string[] = [], candIds: string[] = []) =>
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
          titles: [c.titles_before, c.titles_after].filter(Boolean).join(", ") || null,
        },
        [],
        [c.id],
      );
    }
    const fs = byPerson.get(p.id) ?? [];
    const pay = (f: (typeof fs)[number]) => f.payload as Record<string, unknown>;
    const reason = (f: (typeof fs)[number]) => f.match_reason as Record<string, unknown>;

    for (const f of fs.filter((f) => f.type === "past_candidacy").sort((a, b) => String(a.occurred_from).localeCompare(String(b.occurred_from)))) {
      const d = pay(f);
      add(
        {
          kind: "past_candidacy",
          election: d.election_code,
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
      const current = roles.filter((f) => !f.occurred_to && !pay(f).organisation_terminated);
      add(
        {
          kind: "business_roles_overview",
          total_roles: roles.length,
          current_roles: current.length,
          organisations: new Set(roles.map((f) => pay(f).ico ?? pay(f).organisation)).size,
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
            role: d.role_label ?? d.role,
            since: f.occurred_from,
            ...(d.role === "beneficial_owner" && d.public_official
              ? { rpvs_note: "registered in RPVS as beneficial owner due to a management position in a public company; not ownership" }
              : {}),
            match: match(reason(f)),
          },
          [f.id],
        );
      }
    }
    for (const f of fs.filter((f) => f.type === "ngo_role").slice(0, 5)) {
      const d = pay(f);
      add({ kind: "ngo_role", organisation: d.organisation, role: d.function ?? d.role, since: f.occurred_from }, [f.id]);
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
      for (const f of checks) ratings[String(pay(f).rating)] = (ratings[String(pay(f).rating)] ?? 0) + 1;
      add({ kind: "demagog_fact_checks", count: checks.length, ratings, match: match(reason(checks[0]!)) }, checks.map((f) => f.id));
    }
    const media = fs.filter((f) => f.type === "media_mention");
    if (media.length) {
      const dates = media.map((f) => String(f.occurred_from)).filter((d) => d !== "null").sort();
      add(
        { kind: "media_mentions", count: media.length, from_year: dates[0]?.slice(0, 4), to_year: dates.at(-1)?.slice(0, 4) },
        media.slice(0, 50).map((f) => f.id),
      );
    }
    for (const f of fs.filter((f) => f.type === "encyclopedia")) {
      const d = pay(f);
      add({ kind: "wikipedia", lang: d.lang, intro: String(d.intro ?? "").slice(0, 600), positions: d.position_held, match: match(reason(f)) }, [f.id]);
    }
    for (const f of fs.filter((f) => f.type === "campaign_account")) {
      add({ kind: "campaign_transparent_account", published: Boolean(pay(f).transparent_account) }, [f.id]);
    }

    const sparse = refs.every((r) => r.data.kind === "candidacy_2026");
    const hash = createHash("sha256")
      .update(JSON.stringify({ v: SUMMARY_PROMPT_VERSION, refs: refs.map((r) => r.data) }))
      .digest("hex");
    return { personId: p.id, name: `${p.given_name} ${p.family_name}`, age: p.age_2026, refs, sparse, hash };
  });
}

/** Fixed non-AI summary: used for people with only their 2026 candidacy, and as fallback. */
function template(p: PersonInput): Record<Lang, { text: string; refs: string[] }[]> {
  const cands = p.refs.filter((r) => r.data.kind === "candidacy_2026");
  const race = (r: Ref) =>
    [r.data.race, r.data.municipality, r.data.district ? `obvod ${r.data.district}` : null].filter(Boolean).join(", ");
  const list = cands.map((r) => `${race(r)} (${r.data.party})`).join("; ");
  const ids = cands.map((r) => r.id);
  const others = p.refs.length > cands.length;
  return {
    sk: [
      { text: `${p.name} (${p.age}) kandiduje vo voľbách 2026: ${list}.`, refs: ids },
      { text: others ? "Ďalšie záznamy sú uvedené nižšie." : "V spracovaných zdrojoch nie sú k dispozícii ďalšie záznamy.", refs: ids },
    ],
    en: [
      { text: `${p.name} (${p.age}) is a candidate in the 2026 elections: ${list}.`, refs: ids },
      { text: others ? "Further records are listed below." : "The processed sources contain no further records.", refs: ids },
    ],
    hu: [
      { text: `${p.name} (${p.age}) jelölt a 2026-os választásokon: ${list}.`, refs: ids },
      { text: others ? "További adatok lent találhatók." : "A feldolgozott forrásokban nincs további adat.", refs: ids },
    ],
  };
}

/**
 * Summaries per person in sk/en/hu (specs/koho-volim, AI Summary Rules) via headless Claude Code.
 * Every AI sentence must cite given item ids; otherwise the fixed template is stored instead.
 * Unchanged inputs (same hash and prompt version) are skipped.
 */
export async function summaries(): Promise<Stats> {
  const all = await inputs();
  const existing = new Map(
    (await db.selectFrom("ai_summary").select(["person_id", "input_hash"]).where("lang", "=", "sk").execute()).map((r) => [
      r.person_id,
      r.input_hash,
    ]),
  );
  const only = process.env.PIPELINE_ONLY?.split(",");
  const todo = all
    .filter((p) => !only || only.some((n) => p.name.endsWith(` ${n}`)))
    .filter((p) => existing.get(p.personId) !== p.hash)
    .slice(0, process.env.PIPELINE_LIMIT ? Number(process.env.PIPELINE_LIMIT) : undefined);

  const store = async (
    p: PersonInput,
    method: "ai" | "template",
    model: string | null,
    out: Record<Lang, { text: string; refs: string[] }[]>,
  ) => {
    const byId = new Map(p.refs.map((r) => [r.id, r]));
    for (const lang of LANGS) {
      const sentences = out[lang].map((s) => ({
        text: s.text,
        fact_ids: [...new Set(s.refs.flatMap((id) => byId.get(id)?.facts ?? []))],
        candidacy_ids: [...new Set(s.refs.flatMap((id) => byId.get(id)?.candidacies ?? []))],
      }));
      await db
        .insertInto("ai_summary")
        .values({
          person_id: p.personId,
          lang,
          sentences: jsonb(sentences),
          method,
          model,
          prompt_version: SUMMARY_PROMPT_VERSION,
          input_hash: p.hash,
        })
        .onConflict((oc) =>
          oc.columns(["person_id", "lang"]).doUpdateSet({
            sentences: jsonb(sentences),
            method,
            model,
            prompt_version: SUMMARY_PROMPT_VERSION,
            input_hash: p.hash,
            generated_at: sql`now()`,
          }),
        )
        .execute();
    }
  };

  let templated = 0;
  for (const p of todo.filter((p) => p.sparse)) {
    await store(p, "template", null, template(p));
    templated++;
  }

  const sentence = {
    type: "object",
    properties: { text: { type: "string" }, refs: { type: "array", items: { type: "string" }, minItems: 1 } },
    required: ["text", "refs"],
  };
  const langBlock = { type: "array", items: sentence, minItems: 1, maxItems: 5 };
  const schema = {
    type: "object",
    properties: {
      people: {
        type: "array",
        items: {
          type: "object",
          properties: { person: { type: "string" }, sk: langBlock, en: langBlock, hu: langBlock },
          required: ["person", "sk", "en", "hu"],
        },
      },
    },
    required: ["people"],
  };

  const rich = todo.filter((p) => !p.sparse);
  const batches: PersonInput[][] = [];
  for (let i = 0; i < rich.length; i += BATCH) batches.push(rich.slice(i, i + BATCH));
  const model = process.env.CLAUDE_MODEL ?? "sonnet";
  let ai = 0;
  let fallback = 0;
  let cost = 0;
  await mapPool(batches, 3, 0, async (batch) => {
    const prompt =
      "Write the summaries for these people. Each person's items have ids; cite them.\n\n" +
      batch
        .map((p, i) => JSON.stringify({ person: `p${i + 1}`, name: p.name, age: p.age, items: p.refs.map((r) => ({ id: r.id, ...r.data })) }))
        .join("\n");
    let output: SummaryOutput | null = null;
    try {
      const res = await claude<SummaryOutput>(SYSTEM, prompt, schema, model);
      output = res.output;
      cost += res.costUsd;
    } catch {
      output = null;
    }
    for (const [i, p] of batch.entries()) {
      const r = output?.people.find((x) => x.person === `p${i + 1}`);
      const ids = new Set(p.refs.map((x) => x.id));
      const valid =
        r &&
        LANGS.every(
          (l) => r[l].length >= 1 && r[l].length <= 5 && r[l].every((s) => s.text.trim() && s.refs.length > 0 && s.refs.every((id) => ids.has(id))),
        );
      if (valid) {
        await store(p, "ai", model, { sk: r.sk, en: r.en, hu: r.hu });
        ai++;
      } else {
        await store(p, "template", null, template(p));
        fallback++;
      }
    }
  });

  return {
    persons: all.length,
    up_to_date: all.length - todo.length,
    template_sparse: templated,
    ai_written: ai,
    template_fallback: fallback,
    usage_usd: Number(cost.toFixed(2)),
  };
}
