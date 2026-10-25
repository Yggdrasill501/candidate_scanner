// Every read the site makes. The database is filled only by pipelines, so results are cached
// for an hour and tagged "data"; a pipeline publish revalidates the tag.
import { cacheLife, cacheTag } from "next/cache";
import { db, sql, type Json } from "@repo/db";
import { isIndependent, normalise, partyParts, slugify } from "./names";

export const ELECTIONS_2026 = ["OSO2026", "VUC2026"] as const;
export const RACE_ORDER = [
  "mayor",
  "municipal_council",
  "regional_governor",
  "regional_council",
] as const;
export type RaceKind = (typeof RACE_ORDER)[number];

/**
 * NSK electoral districts by okres. The Nové Zámky okres is split between districts 4 and 6;
 * no public list maps its municipalities, so both are shown and the voter checks the ballot.
 */
export const NSK_DISTRICTS: Record<string, number[]> = {
  Komárno: [1],
  Levice: [2],
  Nitra: [3],
  "Nové Zámky": [4, 6],
  Šaľa: [5],
  Topoľčany: [7],
  "Zlaté Moravce": [8],
};

/** Okres name for an NSK council electoral district number (1–8). */
export function okresForNskDistrict(n: number): string | null {
  for (const [okres, nums] of Object.entries(NSK_DISTRICTS)) {
    if (nums.includes(n)) return okres;
  }
  return null;
}

function cached(...tags: string[]) {
  cacheLife("hours");
  cacheTag("data", ...tags);
}

export interface MatchReason {
  matched?: string[];
  mismatched?: string[];
  unavailable?: string[];
  namesakes?: number;
  ambiguous?: number;
  basis?: string;
  body?: string;
}

// ---- site ---------------------------------------------------------------

export interface SiteStats {
  people: number;
  candidacies: number;
  municipalities: number;
  races: number;
  dataDate: string | null;
}

export async function getSiteStats(): Promise<SiteStats> {
  "use cache";
  cached();
  const { rows } = await sql<{
    people: string;
    candidacies: string;
    municipalities: string;
    races: string;
    data_date: string | null;
  }>`
    select
      (select count(distinct c.person_id) from candidacy c join race r on r.id = c.race_id
        where r.election_code in ('OSO2026', 'VUC2026')) as people,
      (select count(*) from candidacy c join race r on r.id = c.race_id
        where r.election_code in ('OSO2026', 'VUC2026')) as candidacies,
      (select count(*) from municipality) as municipalities,
      (select count(*) from race where election_code in ('OSO2026', 'VUC2026')) as races,
      (select to_char(max(ss.retrieved_at) at time zone 'Europe/Bratislava', 'YYYY-MM-DD')
        from source_snapshot ss join source s on s.id = ss.source_id
        where s.code = 'minv_candidates') as data_date
  `.execute(db);
  const r = rows[0]!;
  return {
    people: Number(r.people),
    candidacies: Number(r.candidacies),
    municipalities: Number(r.municipalities),
    races: Number(r.races),
    dataDate: r.data_date,
  };
}

export interface MunicipalityRow {
  code: string;
  name: string;
  slug: string;
  district: string;
  candidates: number;
}

export async function getMunicipalities(): Promise<MunicipalityRow[]> {
  "use cache";
  cached();
  const { rows } = await sql<{
    code: string;
    name: string;
    slug: string;
    district_name: string;
    candidates: string;
  }>`
    select m.code, m.name, m.slug, m.district_name,
      (select count(*) from candidacy c join race r on r.id = c.race_id
        where r.municipality_code = m.code and r.election_code = 'OSO2026') as candidates
    from municipality m
  `.execute(db);
  const sk = new Intl.Collator("sk");
  return rows
    .map((r) => ({
      code: r.code,
      name: r.name,
      slug: r.slug,
      district: r.district_name,
      candidates: Number(r.candidates),
    }))
    .sort(
      (a, b) =>
        sk.compare(a.district, b.district) || sk.compare(a.name, b.name),
    );
}

// ---- races --------------------------------------------------------------

export interface RaceRef {
  slug: string;
  kind: RaceKind;
  district: number | null;
  municipality: string | null;
  municipalitySlug: string | null;
  okres: string | null;
  candidates: number;
}

const raceRefSelect = sql`
  select r.slug, r.kind, d.number as district, m.name as municipality,
    m.slug as municipality_slug, m.district_name as okres,
    (select count(*) from candidacy c where c.race_id = r.id) as candidates
  from race r
  left join electoral_district d on d.id = r.electoral_district_id
  left join municipality m on m.code = r.municipality_code
`;

type RaceRefRow = {
  slug: string;
  kind: RaceKind;
  district: number | null;
  municipality: string | null;
  municipality_slug: string | null;
  okres: string | null;
  candidates: string;
};

function toRaceRef(r: RaceRefRow): RaceRef {
  return {
    slug: r.slug,
    kind: r.kind,
    district: r.district,
    municipality: r.municipality,
    municipalitySlug: r.municipality_slug,
    okres: r.okres,
    candidates: Number(r.candidates),
  };
}

export async function getRegionalRaces(): Promise<RaceRef[]> {
  "use cache";
  cached();
  const { rows } = await sql<RaceRefRow>`
    ${raceRefSelect}
    where r.election_code = 'VUC2026'
    order by r.kind = 'regional_council', d.number
  `.execute(db);
  return rows.map(toRaceRef);
}

export interface Ballot {
  municipality: MunicipalityRow;
  mayor: RaceRef | null;
  councils: RaceRef[];
  governor: RaceRef | null;
  regional: RaceRef[];
}

export async function getBallot(slug: string): Promise<Ballot | null> {
  "use cache";
  cached(`obec:${slug}`);
  const m = await db
    .selectFrom("municipality")
    .select(["code", "name", "slug", "district_name"])
    .where("slug", "=", slug)
    .executeTakeFirst();
  if (!m) return null;
  const { rows } = await sql<RaceRefRow>`
    ${raceRefSelect}
    where r.election_code = 'OSO2026' and r.municipality_code = ${m.code}
    order by r.kind, d.number
  `.execute(db);
  const local = rows.map(toRaceRef);
  const regional = await getRegionalRaces();
  const nsk = NSK_DISTRICTS[m.district_name] ?? [];
  return {
    municipality: {
      code: m.code,
      name: m.name,
      slug: m.slug,
      district: m.district_name,
      candidates: local.reduce((n, r) => n + r.candidates, 0),
    },
    mayor: local.find((r) => r.kind === "mayor") ?? null,
    councils: local.filter((r) => r.kind === "municipal_council"),
    governor: regional.find((r) => r.kind === "regional_governor") ?? null,
    regional: regional.filter(
      (r) => r.kind === "regional_council" && nsk.includes(r.district ?? -1),
    ),
  };
}

export interface RaceCandidate {
  candidacyId: string;
  ballotNumber: number | null;
  titlesBefore: string | null;
  titlesAfter: string | null;
  givenName: string;
  familyName: string;
  age: number | null;
  occupation: string | null;
  party: string | null;
  residence: string | null;
  personSlug: string | null;
  pastCandidacies: number;
  pastElected: number;
  businessRoles: number;
  attendance: { present: number; total: number } | null;
  summary: string | null;
}

export interface Race extends RaceRef {
  electionCode: string;
  municipalityCode: string | null;
  seats: number | null;
  candidatesList: RaceCandidate[];
}

export async function getRace(
  slug: string,
  lang: string,
): Promise<Race | null> {
  "use cache";
  cached(`race:${slug}`);
  const { rows } = await sql<
    RaceRefRow & {
      id: string;
      election_code: string;
      municipality_code: string | null;
      seats: number | null;
    }
  >`
    select r.id, r.election_code, r.municipality_code, r.seats, r.slug, r.kind,
      d.number as district,
      m.name as municipality, m.slug as municipality_slug, m.district_name as okres,
      (select count(*) from candidacy c where c.race_id = r.id) as candidates
    from race r
    left join electoral_district d on d.id = r.electoral_district_id
    left join municipality m on m.code = r.municipality_code
    where r.slug = ${slug}
  `.execute(db);
  const race = rows[0];
  if (!race) return null;

  const { rows: cands } = await sql<{
    id: string;
    ballot_number: number | null;
    titles_before: string | null;
    titles_after: string | null;
    given_name: string;
    family_name: string;
    age: number | null;
    occupation: string | null;
    party_label: string | null;
    residence_municipality: string | null;
    person_slug: string | null;
    past: string;
    past_elected: string;
    roles: string;
    present_votes: number | null;
    total_votes: number | null;
    summary: Json | null;
  }>`
    select c.id, c.ballot_number, c.titles_before, c.titles_after, c.given_name, c.family_name,
      c.age, c.occupation, c.party_label, c.residence_municipality, p.slug as person_slug,
      (select count(*) from fact f where f.person_id = p.id and f.type = 'past_candidacy') as past,
      (select count(*) from fact f where f.person_id = p.id and f.type = 'past_candidacy'
        and (f.payload->>'elected')::boolean) as past_elected,
      (select count(*) from fact f where f.person_id = p.id
        and f.type in ('business_role', 'ngo_role')) as roles,
      att.present_votes, att.total_votes,
      (select s.sentences from ai_summary s where s.person_id = p.id and s.lang = ${lang}) as summary
    from candidacy c
    left join person p on p.id = c.person_id
    left join lateral (
      select (f.payload->>'present_votes')::int as present_votes,
        (f.payload->>'total_votes')::int as total_votes
      from fact f where f.person_id = p.id and f.type = 'attendance'
      order by f.occurred_from desc limit 1
    ) att on true
    where c.race_id = ${race.id}
    order by c.ballot_number, c.family_name
  `.execute(db);

  return {
    ...toRaceRef(race),
    electionCode: race.election_code,
    municipalityCode: race.municipality_code,
    seats: race.seats,
    candidatesList: cands.map((c) => ({
      candidacyId: c.id,
      ballotNumber: c.ballot_number,
      titlesBefore: c.titles_before,
      titlesAfter: c.titles_after,
      givenName: c.given_name,
      familyName: c.family_name,
      age: c.age,
      occupation: c.occupation,
      party: c.party_label,
      residence: c.residence_municipality,
      personSlug: c.person_slug,
      pastCandidacies: Number(c.past),
      pastElected: Number(c.past_elected),
      businessRoles: Number(c.roles),
      attendance:
        c.present_votes !== null && c.total_votes
          ? { present: c.present_votes, total: c.total_votes }
          : null,
      summary: firstSentence(c.summary),
    })),
  };
}

function firstSentence(sentences: Json | null): string | null {
  if (!Array.isArray(sentences)) return null;
  const first = sentences[0] as { text?: string } | undefined;
  return first?.text ?? null;
}

// ---- people -------------------------------------------------------------

export interface Candidacy2026 {
  id: string;
  ballotNumber: number | null;
  titlesBefore: string | null;
  titlesAfter: string | null;
  age: number | null;
  occupation: string | null;
  party: string | null;
  residence: string | null;
  race: RaceRef;
  sourceUrl: string;
  retrievedAt: string;
}

export interface Fact {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  from: string | null;
  to: string | null;
  sourceCode: string;
  sourceName: string;
  sourceUrl: string;
  retrievedAt: string;
  sha256: string;
  method: string;
  match: MatchReason;
}

export interface SummarySentence {
  text: string;
  fact_ids: string[];
  candidacy_ids: string[];
}

export interface Summary {
  lang: string;
  method: "ai" | "template";
  model: string | null;
  generatedAt: string;
  sentences: SummarySentence[];
}

export interface SourceUse {
  code: string;
  name: string;
  baseUrl: string;
  kind: string;
  lastRetrieved: string;
  facts: number;
}

export interface Person {
  id: string;
  slug: string;
  givenName: string;
  familyName: string;
  age: number;
  candidacies: Candidacy2026[];
  facts: Fact[];
  summaries: Summary[];
  sources: SourceUse[];
  outcomes: { sourceCode: string; status: string; checkedAt: string }[];
}

/** Every fact of a person except single council votes, which have their own query. */
export async function getPerson(slug: string): Promise<Person | null> {
  "use cache";
  cached(`person:${slug}`);
  const p = await db
    .selectFrom("person")
    .select(["id", "slug", "given_name", "family_name", "age_2026"])
    .where("slug", "=", slug)
    .executeTakeFirst();
  if (!p) return null;

  const [cands, facts, summaries, sources, outcomes] = await Promise.all([
    sql<
      RaceRefRow & {
        id: string;
        ballot_number: number | null;
        titles_before: string | null;
        titles_after: string | null;
        age: number | null;
        occupation: string | null;
        party_label: string | null;
        residence_municipality: string | null;
        source_url: string;
        retrieved_at: string;
      }
    >`
      select c.id, c.ballot_number, c.titles_before, c.titles_after, c.age, c.occupation,
        c.party_label, c.residence_municipality, ss.url as source_url,
        to_char(ss.retrieved_at at time zone 'Europe/Bratislava', 'YYYY-MM-DD') as retrieved_at,
        r.slug, r.kind, d.number as district, m.name as municipality,
        m.slug as municipality_slug, m.district_name as okres,
        (select count(*) from candidacy c2 where c2.race_id = r.id) as candidates
      from candidacy c
      join race r on r.id = c.race_id
      join source_snapshot ss on ss.id = c.snapshot_id
      left join electoral_district d on d.id = r.electoral_district_id
      left join municipality m on m.code = r.municipality_code
      where c.person_id = ${p.id} and r.election_code in ('OSO2026', 'VUC2026')
      order by array_position(array['mayor', 'municipal_council', 'regional_governor',
        'regional_council'], r.kind)
    `.execute(db),
    sql<{
      id: string;
      type: string;
      payload: Record<string, unknown>;
      occurred_from: string | null;
      occurred_to: string | null;
      source_code: string;
      source_name: string;
      source_url: string;
      retrieved_at: string;
      sha256: string;
      method: string;
      match_reason: MatchReason;
    }>`
      select f.id, f.type, f.payload, f.occurred_from::text, f.occurred_to::text,
        s.code as source_code, s.name as source_name, f.source_url,
        to_char(ss.retrieved_at at time zone 'Europe/Bratislava', 'YYYY-MM-DD') as retrieved_at,
        ss.sha256, f.method, f.match_reason
      from fact f
      join source s on s.id = f.source_id
      join source_snapshot ss on ss.id = f.snapshot_id
      where f.person_id = ${p.id} and f.type <> 'council_vote'
      order by f.occurred_from nulls last, f.created_at
    `.execute(db),
    sql<{
      lang: string;
      method: "ai" | "template";
      model: string | null;
      generated_at: string;
      sentences: SummarySentence[];
    }>`
      select lang, method, model, sentences,
        to_char(generated_at at time zone 'Europe/Bratislava', 'YYYY-MM-DD') as generated_at
      from ai_summary where person_id = ${p.id}
    `.execute(db),
    sql<{
      code: string;
      name: string;
      base_url: string;
      kind: string;
      last_retrieved: string;
      facts: string;
    }>`
      select s.code, s.name, s.base_url, s.kind, count(*) as facts,
        to_char(max(ss.retrieved_at) at time zone 'Europe/Bratislava', 'YYYY-MM-DD') as last_retrieved
      from (
        select f.source_id, f.snapshot_id from fact f where f.person_id = ${p.id}
        union all
        select ss2.source_id, c.snapshot_id from candidacy c
          join source_snapshot ss2 on ss2.id = c.snapshot_id where c.person_id = ${p.id}
      ) u
      join source s on s.id = u.source_id
      join source_snapshot ss on ss.id = u.snapshot_id
      group by s.code, s.name, s.base_url, s.kind
      order by s.kind, s.name
    `.execute(db),
    sql<{ source_code: string; status: string; checked_at: string }>`
      select distinct on (o.source_id) s.code as source_code, o.status,
        to_char(o.checked_at at time zone 'Europe/Bratislava', 'YYYY-MM-DD') as checked_at
      from source_outcome o join source s on s.id = o.source_id
      where o.person_id = ${p.id}
      order by o.source_id, o.checked_at desc
    `.execute(db),
  ]);

  return {
    id: p.id,
    slug: p.slug,
    givenName: p.given_name,
    familyName: p.family_name,
    age: p.age_2026,
    candidacies: cands.rows.map((c) => ({
      id: c.id,
      ballotNumber: c.ballot_number,
      titlesBefore: c.titles_before,
      titlesAfter: c.titles_after,
      age: c.age,
      occupation: c.occupation,
      party: c.party_label,
      residence: c.residence_municipality,
      race: toRaceRef(c),
      sourceUrl: c.source_url,
      retrievedAt: c.retrieved_at,
    })),
    facts: facts.rows.map((f) => ({
      id: f.id,
      type: f.type,
      payload: f.payload,
      from: f.occurred_from,
      to: f.occurred_to,
      sourceCode: f.source_code,
      sourceName: f.source_name,
      sourceUrl: f.source_url,
      retrievedAt: f.retrieved_at,
      sha256: f.sha256,
      method: f.method,
      match: f.match_reason ?? {},
    })),
    summaries: summaries.rows.map((s) => ({
      lang: s.lang,
      method: s.method,
      model: s.model,
      generatedAt: s.generated_at,
      sentences: s.sentences,
    })),
    sources: sources.rows.map((s) => ({
      code: s.code,
      name: s.name,
      baseUrl: s.base_url,
      kind: s.kind,
      lastRetrieved: s.last_retrieved,
      facts: Number(s.facts),
    })),
    outcomes: outcomes.rows.map((o) => ({
      sourceCode: o.source_code,
      status: o.status,
      checkedAt: o.checked_at,
    })),
  };
}

// ---- council votes ------------------------------------------------------

export interface PersonVote {
  factId: string;
  choice: "for" | "against" | "abstain" | "not_voting" | "absent";
  voteNumber: number;
  description: string;
  kind: string;
  counts: [number | null, number | null, number | null];
  isKey: boolean;
  inconsistent: boolean;
  itemTitle: string | null;
  material: string | null;
  topic: string;
  sessionNumber: number | null;
  sessionDate: string;
  sessionSlug: string;
  body: string;
  pdfUrl: string;
}

export interface VoteOverview {
  bodies: {
    body: string;
    terms: {
      from: string;
      to: string | null;
      present: number;
      total: number;
    }[];
  }[];
  topics: { code: string; name: string; items: number; votes: number }[];
  keyVotes: PersonVote[];
  keyTotal: number;
  total: number;
}

const voteSelect = sql`
  select f.id as fact_id, f.payload->>'choice' as choice, v.number as vote_number,
    v.description, v.kind, v.count_for, v.count_against, v.count_abstain, v.is_key,
    v.source_inconsistency, a.title as item_title, a.material_number,
    coalesce(a.topic_code, 'other') as topic, s.number as session_number,
    s.held_on::text as session_date, s.slug as session_slug, b.name as body, f.source_url
  from fact f
  join vote v on v.id = (f.payload->>'vote_id')::uuid
  join session s on s.id = v.session_id
  join body b on b.id = s.body_id
  left join agenda_item a on a.id = v.agenda_item_id
`;

type VoteRow = {
  fact_id: string;
  choice: PersonVote["choice"];
  vote_number: number;
  description: string;
  kind: string;
  count_for: number | null;
  count_against: number | null;
  count_abstain: number | null;
  is_key: boolean;
  source_inconsistency: boolean;
  item_title: string | null;
  material_number: string | null;
  topic: string;
  session_number: number | null;
  session_date: string;
  session_slug: string;
  body: string;
  source_url: string;
};

function toVote(r: VoteRow): PersonVote {
  return {
    factId: r.fact_id,
    choice: r.choice,
    voteNumber: r.vote_number,
    description: r.description,
    kind: r.kind,
    counts: [r.count_for, r.count_against, r.count_abstain],
    isKey: r.is_key,
    inconsistent: r.source_inconsistency,
    itemTitle: r.item_title,
    material: r.material_number,
    topic: r.topic,
    sessionNumber: r.session_number,
    sessionDate: r.session_date,
    sessionSlug: r.session_slug,
    body: r.body,
    pdfUrl: r.source_url,
  };
}

export async function getVoteOverview(
  personId: string,
  lang: string,
): Promise<VoteOverview | null> {
  "use cache";
  cached(`votes:${personId}`);
  const nameCol =
    lang === "en" ? "name_en" : lang === "hu" ? "name_hu" : "name_sk";
  const [topics, keys, totals, attendance] = await Promise.all([
    sql<{ code: string; name: string; items: string; votes: string }>`
      select t.code, ${sql.ref(`t.${nameCol}`)} as name,
        count(distinct coalesce(v.agenda_item_id, v.id)) filter (where f.id is not null) as items,
        count(f.id) as votes
      from topic t
      left join agenda_item a on a.topic_code = t.code
      left join vote v on v.agenda_item_id = a.id
      left join fact f on f.type = 'council_vote' and f.person_id = ${personId}
        and (f.payload->>'vote_id')::uuid = v.id
      group by t.code, t.position, ${sql.ref(`t.${nameCol}`)}
      order by t.position
    `.execute(db),
    sql<VoteRow>`
      ${voteSelect}
      where f.person_id = ${personId} and f.type = 'council_vote' and v.is_key
      order by s.held_on desc, v.number desc
      limit 10
    `.execute(db),
    sql<{ total: string; key_total: string }>`
      select count(*) as total, count(*) filter (where v.is_key) as key_total
      from fact f join vote v on v.id = (f.payload->>'vote_id')::uuid
      where f.person_id = ${personId} and f.type = 'council_vote'
    `.execute(db),
    sql<{
      body: string;
      starts_on: string;
      ends_on: string | null;
      present: number;
      total: number;
    }>`
      select b.name as body, t.starts_on::text, t.ends_on::text,
        (f.payload->>'present_votes')::int as present, (f.payload->>'total_votes')::int as total
      from fact f
      join term t on t.id = (f.payload->>'term_id')::uuid
      join body b on b.id = t.body_id
      where f.person_id = ${personId} and f.type = 'attendance'
      order by t.starts_on
    `.execute(db),
  ]);
  const total = Number(totals.rows[0]?.total ?? 0);
  if (!total && !attendance.rows.length) return null;
  const bodies = new Map<string, VoteOverview["bodies"][number]>();
  for (const a of attendance.rows) {
    const b = bodies.get(a.body) ?? { body: a.body, terms: [] };
    b.terms.push({
      from: a.starts_on,
      to: a.ends_on,
      present: a.present,
      total: a.total,
    });
    bodies.set(a.body, b);
  }
  return {
    bodies: [...bodies.values()],
    topics: topics.rows.map((t) => ({
      code: t.code,
      name: t.name,
      items: Number(t.items),
      votes: Number(t.votes),
    })),
    keyVotes: keys.rows.map(toVote),
    keyTotal: Number(totals.rows[0]?.key_total ?? 0),
    total,
  };
}

/** One page of a person's votes on one topic (or only key votes), newest first. */
export async function getPersonVotes(
  personId: string,
  filter: { topic?: string; key?: boolean },
  page: number,
  pageSize: number,
): Promise<{ total: number; votes: PersonVote[] }> {
  "use cache";
  cached(`votes:${personId}`);
  const where = sql`
    where f.person_id = ${personId} and f.type = 'council_vote'
      ${filter.topic ? sql`and coalesce(a.topic_code, 'other') = ${filter.topic}` : sql``}
      ${filter.key ? sql`and v.is_key` : sql``}
  `;
  const [{ rows }, count] = await Promise.all([
    sql<VoteRow>`
      ${voteSelect}
      ${where}
      order by s.held_on desc, v.number
      limit ${pageSize} offset ${(page - 1) * pageSize}
    `.execute(db),
    sql<{ n: string }>`
      select count(*) as n
      from fact f
      join vote v on v.id = (f.payload->>'vote_id')::uuid
      left join agenda_item a on a.id = v.agenda_item_id
      ${where}
    `.execute(db),
  ]);
  return { total: Number(count.rows[0]?.n ?? 0), votes: rows.map(toVote) };
}

export async function getTopics(
  lang: string,
): Promise<{ code: string; name: string }[]> {
  "use cache";
  cached();
  const nameCol =
    lang === "en" ? "name_en" : lang === "hu" ? "name_hu" : "name_sk";
  const { rows } = await sql<{ code: string; name: string }>`
    select code, ${sql.ref(nameCol)} as name from topic order by position
  `.execute(db);
  return rows;
}

// ---- parties ------------------------------------------------------------

export interface PartyRef {
  slug: string;
  name: string;
  candidacies: number;
}

/** Parties named on 2026 lists, each coalition member counted on its own. */
export async function getParties(): Promise<PartyRef[]> {
  "use cache";
  cached();
  const { rows } = await sql<{ party_label: string; n: string }>`
    select c.party_label, count(*) as n
    from candidacy c join race r on r.id = c.race_id
    where r.election_code in ('OSO2026', 'VUC2026') and c.party_label is not null
    group by c.party_label
  `.execute(db);
  const parties = new Map<string, PartyRef>();
  for (const r of rows) {
    if (isIndependent(r.party_label)) continue;
    for (const part of partyParts(r.party_label)) {
      const slug = slugify(part);
      const p = parties.get(slug) ?? { slug, name: part, candidacies: 0 };
      p.candidacies += Number(r.n);
      parties.set(slug, p);
    }
  }
  return [...parties.values()].sort((a, b) => b.candidacies - a.candidacies);
}

export interface PartyCandidacy {
  race: RaceRef;
  ballotNumber: number | null;
  name: string;
  titlesBefore: string | null;
  titlesAfter: string | null;
  label: string;
  personSlug: string | null;
}

export async function getParty(
  slug: string,
): Promise<{ party: PartyRef; candidacies: PartyCandidacy[] } | null> {
  "use cache";
  cached(`party:${slug}`);
  const party = (await getParties()).find((p) => p.slug === slug);
  if (!party) return null;
  const { rows } = await sql<
    RaceRefRow & {
      ballot_number: number | null;
      given_name: string;
      family_name: string;
      titles_before: string | null;
      titles_after: string | null;
      party_label: string;
      person_slug: string | null;
    }
  >`
    select c.ballot_number, c.given_name, c.family_name, c.titles_before, c.titles_after,
      c.party_label, p.slug as person_slug,
      r.slug, r.kind, d.number as district, m.name as municipality,
      m.slug as municipality_slug, m.district_name as okres,
      (select count(*) from candidacy c2 where c2.race_id = r.id) as candidates
    from candidacy c
    join race r on r.id = c.race_id
    left join person p on p.id = c.person_id
    left join electoral_district d on d.id = r.electoral_district_id
    left join municipality m on m.code = r.municipality_code
    where r.election_code in ('OSO2026', 'VUC2026')
      and immutable_unaccent(lower(c.party_label)) like ${"%" + normalise(party.name).replace(/ /g, "%") + "%"}
    order by array_position(array['regional_governor', 'regional_council', 'mayor',
      'municipal_council'], r.kind), m.district_name, m.name, d.number, c.ballot_number
  `.execute(db);
  return {
    party,
    candidacies: rows
      .filter((r) => partyParts(r.party_label).some((p) => slugify(p) === slug))
      .map((r) => ({
        race: toRaceRef(r),
        ballotNumber: r.ballot_number,
        name: `${r.given_name} ${r.family_name}`,
        titlesBefore: r.titles_before,
        titlesAfter: r.titles_after,
        label: r.party_label,
        personSlug: r.person_slug,
      })),
  };
}

// ---- search -------------------------------------------------------------

export interface SearchHit {
  kind: "person" | "party" | "municipality" | "okres";
  slug: string;
  label: string;
  /** Place of the person's main 2026 race, okres of a municipality, count for a party or okres. */
  meta: string;
  raceKind?: RaceKind;
}

export interface SearchResult {
  q: string;
  person: SearchHit[];
  party: SearchHit[];
  municipality: SearchHit[];
  okres: SearchHit[];
}

// "Okres Levice", "Levice district", "Lévai járás": the word for okres is not part of the name.
const OKRES_WORDS = /\b(okres|okresy|district|jaras)\b/g;

export async function search(query: string, limit = 10): Promise<SearchResult> {
  "use cache";
  cached();
  const q = normalise(query);
  const empty: SearchResult = {
    q: query,
    person: [],
    party: [],
    municipality: [],
    okres: [],
  };
  if (q.length < 2) return empty;
  const place = q.replace(OKRES_WORDS, " ").replace(/\s+/g, " ").trim();

  const [people, munis, parties] = await Promise.all([
    sql<{
      slug: string;
      given_name: string;
      family_name: string;
      kind: RaceKind | null;
      place: string | null;
    }>`
      select p.slug, p.given_name, p.family_name, c.kind, c.place
      from person p
      join lateral (
        select r.kind, m.name as place
        from candidacy c join race r on r.id = c.race_id
        left join municipality m on m.code = r.municipality_code
        where c.person_id = p.id and r.election_code in ('OSO2026', 'VUC2026')
        order by array_position(array['regional_governor', 'mayor', 'regional_council',
          'municipal_council'], r.kind)
        limit 1
      ) c on true
      where p.normalised_name like ${"%" + q + "%"}
         or p.normalised_name % ${q}
         or word_similarity(${q}, p.normalised_name) > 0.6
      order by (p.normalised_name like ${q + "%"}) desc,
        (p.normalised_name like ${"%" + q + "%"}) desc,
        similarity(p.normalised_name, ${q}) desc, p.family_name
      limit ${limit}
    `.execute(db),
    sql<{ slug: string; name: string; district_name: string }>`
      select slug, name, district_name from municipality
      where immutable_unaccent(lower(name)) like ${"%" + q + "%"}
         or immutable_unaccent(lower(name)) % ${q}
      order by (immutable_unaccent(lower(name)) like ${q + "%"}) desc,
        similarity(immutable_unaccent(lower(name)), ${q}) desc, name
      limit ${limit}
    `.execute(db),
    getParties(),
  ]);
  const perOkres = new Map<string, number>();
  for (const m of await getMunicipalities())
    perOkres.set(m.district, (perOkres.get(m.district) ?? 0) + 1);

  const words = q.split(" ");
  return {
    q: query,
    person: people.rows.map((p) => ({
      kind: "person",
      slug: p.slug,
      label: `${p.given_name} ${p.family_name}`,
      meta: p.place ?? "",
      raceKind: p.kind ?? undefined,
    })),
    municipality: munis.rows.map((m) => ({
      kind: "municipality",
      slug: m.slug,
      label: m.name,
      meta: m.district_name,
    })),
    okres:
      place.length < 2
        ? []
        : [...perOkres]
            .filter(([name]) => {
              const n = normalise(name);
              return n.includes(place) || place.includes(n);
            })
            .map(([name, count]) => ({
              kind: "okres",
              slug: slugify(name),
              label: name,
              meta: String(count),
            })),
    party: parties
      .filter((p) => {
        const n = normalise(p.name);
        return words.every((w) => n.includes(w));
      })
      .slice(0, limit)
      .map((p) => ({
        kind: "party",
        slug: p.slug,
        label: p.name,
        meta: String(p.candidacies),
      })),
  };
}

// ---- sources ------------------------------------------------------------

export interface SourceInfo {
  code: string;
  name: string;
  baseUrl: string;
  kind: string;
  snapshots: number;
  lastRetrieved: string | null;
  facts: number;
}

export async function getSources(): Promise<SourceInfo[]> {
  "use cache";
  cached();
  const { rows } = await sql<{
    code: string;
    name: string;
    base_url: string;
    kind: string;
    snapshots: string;
    last_retrieved: string | null;
    facts: string;
  }>`
    select s.code, s.name, s.base_url, s.kind,
      (select count(*) from source_snapshot ss where ss.source_id = s.id) as snapshots,
      (select to_char(max(ss.retrieved_at) at time zone 'Europe/Bratislava', 'YYYY-MM-DD')
        from source_snapshot ss where ss.source_id = s.id) as last_retrieved,
      (select count(*) from fact f where f.source_id = s.id) as facts
    from source s
    order by s.kind, s.name
  `.execute(db);
  return rows.map((r) => ({
    code: r.code,
    name: r.name,
    baseUrl: r.base_url,
    kind: r.kind,
    snapshots: Number(r.snapshots),
    lastRetrieved: r.last_retrieved,
    facts: Number(r.facts),
  }));
}
