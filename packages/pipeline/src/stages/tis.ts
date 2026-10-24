import { db, jsonb, sql } from "@repo/db";
import { normalise } from "../lib/names";
import type { Stats } from "../lib/run";
import { fetchSnapshot } from "../lib/snapshot";
import { sourceId } from "../lib/sources";

const API = "https://tiacms.transparency.sk/elections";
const ELECTION = "s-26";

interface TisCandidate {
  uid: number;
  municipality: string | null;
  region: string | null;
  isRegionalFunction: boolean;
  account: string | null;
  partyAccounts: string[];
  person: { fullName: string; assetDeclarationsExtended: { url: string }[] };
}

interface TisSet {
  name: string;
  date: number;
  evaluations: {
    candidate: number | null;
    score: number;
    web: string | null;
    social: string[];
    criteriaScores: Record<string, number>;
  }[];
  criteria: { uid: number; group: string; title: string }[];
}

/**
 * Transparency International Slovensko's 2026 monitoring for Nitra mayoral and NSK chair
 * candidates: campaign accounts, extended asset declarations and TIS's own evaluation of
 * campaign transparency (attributed to TIS, not a fact established by this site).
 */
export async function tis(): Promise<Stats> {
  const source = await sourceId("tis");
  const electionSnap = await fetchSnapshot(
    "tis",
    `${API}/election/${ELECTION}`,
  );
  const evalSnap = await fetchSnapshot("tis", `${API}/evaluations/${ELECTION}`);
  const { candidates } = JSON.parse(electionSnap.bytes.toString("utf-8")) as {
    candidates: TisCandidate[];
  };
  const { sets } = JSON.parse(evalSnap.bytes.toString("utf-8")) as {
    sets: TisSet[];
  };

  // Mayoral candidates by name + municipality, NSK chair candidates by name + race.
  const persons = await db
    .selectFrom("person")
    .innerJoin("candidacy", "candidacy.person_id", "person.id")
    .innerJoin("race", "race.id", "candidacy.race_id")
    .leftJoin("municipality", "municipality.code", "race.municipality_code")
    .select([
      "person.id",
      "person.normalised_name",
      "race.kind",
      sql<string | null>`municipality.name`.as("municipality"),
    ])
    .where("race.kind", "in", ["mayor", "regional_governor"])
    .where("race.election_code", "in", ["OSO2026", "VUC2026"])
    .execute();

  const rows: {
    person_id: string;
    type: string;
    payload: Record<string, unknown>;
    url: string;
    snapshot_id: string;
    reason: Record<string, unknown>;
  }[] = [];
  let unmatched = 0;
  for (const c of candidates.filter((x) => x.region === "NR")) {
    const name = normalise(c.person.fullName);
    const match = persons.find(
      (p) =>
        p.normalised_name === name &&
        (c.isRegionalFunction
          ? p.kind === "regional_governor"
          : p.kind === "mayor" &&
            normalise(p.municipality ?? "") ===
              normalise(c.municipality ?? "")),
    );
    if (!match) {
      unmatched++;
      continue;
    }
    const reason = {
      matched: ["name", c.isRegionalFunction ? "race" : "municipality"],
    };
    const evaluation = sets
      .map((s) => ({ s, e: s.evaluations.find((e) => e.candidate === c.uid) }))
      .find((x) => x.e);

    if (c.account || c.partyAccounts.length || evaluation?.e?.web) {
      rows.push({
        person_id: match.id,
        type: "campaign_account",
        payload: {
          transparent_account: c.account,
          party_accounts: c.partyAccounts,
          web: evaluation?.e?.web ?? null,
          social: evaluation?.e?.social ?? [],
        },
        url: electionSnap.url,
        snapshot_id: electionSnap.id,
        reason,
      });
    }
    for (const d of c.person.assetDeclarationsExtended) {
      rows.push({
        person_id: match.id,
        type: "asset_declaration",
        payload: {
          kind: "tis_extended",
          url: d.url,
          publisher: "Transparency International Slovensko",
        },
        url: d.url,
        snapshot_id: electionSnap.id,
        reason,
      });
    }
    if (evaluation?.e) {
      const titles = new Map(
        evaluation.s.criteria.map((k) => [String(k.uid), k]),
      );
      rows.push({
        person_id: match.id,
        type: "watchdog_evaluation",
        payload: {
          evaluator: "Transparency International Slovensko",
          set: evaluation.s.name,
          evaluated_on: new Date(evaluation.s.date * 1000)
            .toISOString()
            .slice(0, 10),
          score: evaluation.e.score,
          criteria: Object.entries(evaluation.e.criteriaScores).map(
            ([k, v]) => ({
              group: titles.get(k)?.group ?? null,
              title: titles.get(k)?.title ?? k,
              score: v,
            }),
          ),
        },
        url: "https://volby.transparency.sk/samosprava2026/hodnotenia",
        snapshot_id: evalSnap.id,
        reason,
      });
    }
  }

  // A candidate in two races (mayor and NSK chair) appears twice in TIS with the same data.
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    const key = `${r.person_id}|${r.type}|${JSON.stringify(r.payload)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom("fact").where("source_id", "=", source).execute();
    for (const r of unique) {
      await trx
        .insertInto("fact")
        .values({
          person_id: r.person_id,
          type: r.type,
          payload: jsonb(r.payload),
          source_id: source,
          source_url: r.url,
          snapshot_id: r.snapshot_id,
          method: "register",
          match_reason: jsonb(r.reason),
        })
        .execute();
    }
  });

  return {
    tis_candidates_nr: candidates.filter((x) => x.region === "NR").length,
    facts: unique.length,
    persons: new Set(unique.map((r) => r.person_id)).size,
    unmatched,
  };
}
