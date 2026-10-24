import { join } from "node:path";
import { createDatabase, db, jsonb, sql } from "@repo/db";
import { DATA_DIR } from "../lib/env";
import { normalise } from "../lib/names";
import type { Stats } from "../lib/run";
import { registerLocalFile } from "../lib/snapshot";
import { sourceId } from "../lib/sources";

const DUMP_URL =
  "https://ekosystem-slovensko-digital-dumps.s3.eu-central-1.amazonaws.com/rpo2.sql.gz";

interface Entry {
  rpo_id: string;
  ico: string | null;
  organisation: string | null;
  legal_form: string | null;
  terminated: string | null;
  section: "statutory" | "stakeholder";
  role: string | null;
  name: string;
  municipality_code: string | null;
  municipality: string | null;
  valid_from: string | null;
  valid_to: string | null;
}

/**
 * Directors (štatutárny orgán) and shareholders/partners (spoločník) from the RPO dump. RPO has
 * no birth dates, and it covers the whole country, so a role links only when the person's
 * registered address is in the candidate's municipality.
 */
export async function rpo(): Promise<Stats> {
  const source = await sourceId("rpo");
  const url = process.env.EKOSYSTEM_URL;
  if (!url)
    throw new Error("EKOSYSTEM_URL is not set (database with the rpo2 dump)");
  const eko = createDatabase(url);
  const snapshot = await registerLocalFile(
    "rpo",
    DUMP_URL,
    join(DATA_DIR, "dumps", "rpo2.sql.gz"),
    "application/gzip",
  );

  const persons = await db
    .selectFrom("person")
    .innerJoin("candidacy", "candidacy.person_id", "person.id")
    .innerJoin("race", "race.id", "candidacy.race_id")
    .leftJoin("municipality as m", "m.code", "race.municipality_code")
    .leftJoin("municipality as r", (j) =>
      j.on(
        sql`lower(r.name)`,
        "=",
        sql`lower(candidacy.residence_municipality)`,
      ),
    )
    .select([
      "person.id",
      "person.normalised_name",
      sql<string | null>`coalesce(m.code, r.code)`.as("place"),
    ])
    .where("race.election_code", "in", ["OSO2026", "VUC2026"])
    .execute();
  const byName = new Map<string, Map<string, Set<string>>>();
  for (const p of persons) {
    const group =
      byName.get(p.normalised_name) ?? new Map<string, Set<string>>();
    const places = group.get(p.id) ?? new Set<string>();
    if (p.place) places.add(p.place);
    group.set(p.id, places);
    byName.set(p.normalised_name, group);
  }

  let entries: Entry[];
  try {
    await sql`CREATE TEMP TABLE wanted (name text PRIMARY KEY)`.execute(eko);
    const names = [...byName.keys()];
    for (let i = 0; i < names.length; i += 1000) {
      await eko
        .insertInto("wanted" as never)
        .values(names.slice(i, i + 1000).map((name) => ({ name })) as never)
        .execute();
    }
    // Normalisation here mirrors normalise(): unaccent + lowercase + collapse non-letters.
    const result = await sql<Entry>`
      WITH people AS (
        SELECT o.data, 'statutory' AS section, e FROM rpo2.organizations o,
          jsonb_array_elements(coalesce(o.data->'statutoryBodies', '[]')) e
        UNION ALL
        SELECT o.data, 'stakeholder', e FROM rpo2.organizations o,
          jsonb_array_elements(coalesce(o.data->'stakeholders', '[]')) e
      ), named AS (
        SELECT data, section, e,
          trim(regexp_replace(lower(unaccent(
            coalesce((SELECT string_agg(g, ' ') FROM jsonb_array_elements_text(e->'personName'->'givenNames') g), '') || ' ' ||
            coalesce((SELECT string_agg(f, ' ') FROM jsonb_array_elements_text(e->'personName'->'familyNames') f), '')
          )), '[^a-z0-9]+', ' ', 'g')) AS name
        FROM people WHERE e ? 'personName'
      )
      SELECT
        data->>'id' AS rpo_id,
        data->'identifiers'->-1->>'value' AS ico,
        data->'fullNames'->-1->>'value' AS organisation,
        data->'legalForms'->-1->'value'->>'value' AS legal_form,
        data->'termination'->>'value' AS terminated,
        section,
        e->'stakeholderType'->>'value' AS role,
        named.name,
        right(e->'address'->'municipality'->>'code', 6) AS municipality_code,
        e->'address'->'municipality'->>'value' AS municipality,
        e->>'validFrom' AS valid_from,
        e->>'validTo' AS valid_to
      FROM named JOIN wanted w ON w.name = named.name
    `.execute(eko);
    entries = result.rows;
  } finally {
    await eko.destroy();
  }

  const rows: { person_id: string; e: Entry; namesakes: number }[] = [];
  let nameOnly = 0;
  for (const e of entries) {
    const group = byName.get(normalise(e.name));
    if (!group) continue;
    const local = [...group].filter(
      ([, places]) => e.municipality_code && places.has(e.municipality_code),
    );
    if (local.length === 0) {
      nameOnly++;
      continue;
    }
    for (const [personId] of local)
      rows.push({ person_id: personId, e, namesakes: group.size });
  }

  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    const key = `${r.person_id}|${r.e.rpo_id}|${r.e.section}|${r.e.role}|${r.e.valid_from}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom("fact")
      .where("type", "=", "business_role")
      .where("source_id", "=", source)
      .execute();
    for (let i = 0; i < unique.length; i += 500) {
      await trx
        .insertInto("fact")
        .values(
          unique.slice(i, i + 500).map(({ person_id, e, namesakes }) => ({
            person_id,
            type: "business_role",
            payload: jsonb({
              role:
                e.section === "statutory" ? "statutory_body" : "stakeholder",
              role_label: e.role,
              organisation: e.organisation,
              ico: e.ico,
              legal_form: e.legal_form,
              organisation_terminated: e.terminated,
              address_municipality: e.municipality,
              rpo_id: e.rpo_id,
            }),
            occurred_from: e.valid_from,
            occurred_to: e.valid_to,
            source_id: source,
            source_url: `https://api.statistics.sk/rpo/v1/entity/${e.rpo_id}`,
            snapshot_id: snapshot.id,
            method: "register" as const,
            match_reason: jsonb({
              matched: ["name", "municipality"],
              unavailable: ["age"],
              namesakes,
              ...(namesakes > 1 ? { ambiguous: namesakes } : {}),
            }),
          })),
        )
        .execute();
    }
  });

  return {
    entries_with_candidate_names: entries.length,
    linked: unique.length,
    persons: new Set(unique.map((r) => r.person_id)).size,
    not_linked_other_municipality: nameOnly,
  };
}
