import { join } from "node:path";
import { createDatabase, db, jsonb, sql } from "@repo/db";
import { DATA_DIR } from "../lib/env";
import { normalise, stripTitles } from "../lib/names";
import type { Stats } from "../lib/run";
import { registerLocalFile } from "../lib/snapshot";
import { registerSource, sourceId } from "../lib/sources";

const SOURCE = registerSource("rpo_sole_traders", {
  name: "Register právnických osôb (ŠÚ SR) – podnikatelia fyzické osoby, cez Slovensko.Digital datahub",
  base_url: "https://api.statistics.sk/rpo/v1",
  kind: "primary",
});
const DUMP_URL =
  "https://ekosystem-slovensko-digital-dumps.s3.eu-central-1.amazonaws.com/rpo2.sql.gz";

interface Trader {
  rpo_id: string;
  ico: string | null;
  name: string;
  legal_form: string;
  municipality_code: string | null;
  municipality: string | null;
  established: string | null;
  terminated: string | null;
  activities: string[] | null;
}

/** "Ing. Ján Novák - STOLÁRSTVO" -> "Ján Novák": the person's name in a sole trader's business name. */
function personName(businessName: string): string {
  const head =
    businessName.split(/\s+[-–—]\s+|,\s*(?=[^,]*$)/)[0] ?? businessName;
  return stripTitles(head);
}

/**
 * Sole traders (živnostníci, self-employed with a licence, independent farmers) registered at an
 * address in the Nitra region. RPO has no birth dates, so a registration links only when the
 * person's name and the registered municipality match the candidate.
 */
export async function run(): Promise<Stats> {
  const source = await sourceId(SOURCE);
  const url = process.env.EKOSYSTEM_URL;
  if (!url)
    throw new Error("EKOSYSTEM_URL is not set (database with the rpo2 dump)");
  const snapshot = await registerLocalFile(
    SOURCE,
    DUMP_URL,
    join(DATA_DIR, "dumps", "rpo2.sql.gz"),
    "application/gzip",
  );

  const municipalities = await db
    .selectFrom("municipality")
    .select("code")
    .execute();
  const codes = municipalities.map((m) => m.code);

  const eko = createDatabase(url);
  let traders: Trader[];
  try {
    traders = (
      await sql<Trader>`
        SELECT
          data->>'id' AS rpo_id,
          data->'identifiers'->-1->>'value' AS ico,
          data->'fullNames'->-1->>'value' AS name,
          data->'legalForms'->-1->'value'->>'value' AS legal_form,
          right(data->'addresses'->-1->'municipality'->>'code', 6) AS municipality_code,
          data->'addresses'->-1->'municipality'->>'value' AS municipality,
          data->'establishment'->>0 AS established,
          data->'termination'->>0 AS terminated,
          (SELECT array_agg(a->>'economicActivityDescription') FROM
            jsonb_array_elements(coalesce(data->'activities', '[]')) a) AS activities
        FROM rpo2.organizations
        WHERE (data->'legalForms'->-1->'value'->>'value' LIKE 'Podnikateľ-fyzická osoba%'
            OR data->'legalForms'->-1->'value'->>'value' LIKE 'Slobodné povolanie%'
            OR data->'legalForms'->-1->'value'->>'value' LIKE 'Samostatne hospodáriaci roľník%')
          AND right(data->'addresses'->-1->'municipality'->>'code', 6) = ANY(${codes})
      `.execute(eko)
    ).rows;
  } finally {
    await eko.destroy();
  }

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
  const byNamePlace = new Map<string, Set<string>>();
  const namesakes = new Map<string, Set<string>>();
  for (const p of persons) {
    namesakes.set(
      p.normalised_name,
      (namesakes.get(p.normalised_name) ?? new Set()).add(p.id),
    );
    if (!p.place) continue;
    const key = `${p.normalised_name}|${p.place}`;
    byNamePlace.set(key, (byNamePlace.get(key) ?? new Set()).add(p.id));
  }

  const rows: { person_id: string; t: Trader; ambiguous: number }[] = [];
  for (const t of traders) {
    if (!t.name || !t.municipality_code) continue;
    const ids = byNamePlace.get(
      `${normalise(personName(t.name))}|${t.municipality_code}`,
    );
    if (!ids) continue;
    for (const id of ids) rows.push({ person_id: id, t, ambiguous: ids.size });
  }

  await db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom("fact")
      .where("type", "=", "business_role")
      .where("source_id", "=", source)
      .execute();
    for (let i = 0; i < rows.length; i += 500) {
      await trx
        .insertInto("fact")
        .values(
          rows.slice(i, i + 500).map(({ person_id, t, ambiguous }) => ({
            person_id,
            type: "business_role",
            payload: jsonb({
              role: "sole_trader",
              role_label: t.legal_form,
              organisation: t.name,
              ico: t.ico,
              activities: (t.activities ?? []).filter(Boolean).slice(0, 15),
              activities_total: (t.activities ?? []).filter(Boolean).length,
              organisation_terminated: t.terminated,
              address_municipality: t.municipality,
              rpo_id: t.rpo_id,
            }),
            occurred_from: t.established,
            occurred_to: t.terminated,
            source_id: source,
            source_url: `https://api.statistics.sk/rpo/v1/entity/${t.rpo_id}`,
            snapshot_id: snapshot.id,
            method: "register" as const,
            match_reason: jsonb({
              matched: ["name", "municipality"],
              unavailable: ["age"],
              namesakes:
                namesakes.get(
                  personName(t.name) ? normalise(personName(t.name)) : "",
                )?.size ?? 1,
              ...(ambiguous > 1 ? { ambiguous } : {}),
              // "junior"/"ml." etc. in the business name may denote a different family member.
              ...(/\b(junior|senior|ml\.|st\.|jr\.|sr\.|ifj\.|id\.)/i.test(
                t.name,
              )
                ? { name_suffix: true, ambiguous: Math.max(ambiguous, 2) }
                : {}),
            }),
          })),
        )
        .execute();
    }
  });

  return {
    sole_traders_in_region: traders.length,
    linked: rows.length,
    persons: new Set(rows.map((r) => r.person_id)).size,
    current: rows.filter((r) => !r.t.terminated).length,
  };
}
