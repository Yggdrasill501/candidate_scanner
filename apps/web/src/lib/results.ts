/**
 * 2026 election results from ŠÚ SR (volbysr.sk) public JSON.
 * Next.js fetches on race pages; durable fallback is election_result_snapshot.
 * Past elections are out of scope for this version.
 */
import { createHash } from "node:crypto";
import { cacheLife, cacheTag } from "next/cache";
import { db, jsonb } from "@repo/db";
import type { RaceKind } from "./data";

const OSO = "https://volbysr.sk/oso";
const OSK = "https://volbysr.sk/osk";
/** Statistical Office code of Nitriansky kraj. */
const NITRA_KRAJ = "4";
const UA = "KohoVolim/0.1 (neutral candidate profiles; +https://kohovolim.sk)";

export type ResultsStatus = "live" | "counting" | "cached" | "unavailable";

export interface CandidateResult {
  ballotNumber: number;
  votes: number | null;
  voteShare: number | null;
  elected: boolean | null;
}

export interface RaceResults {
  status: ResultsStatus;
  sourceUrl: string;
  updatedAt: string | null;
  fromCache: boolean;
  byBallot: Record<number, CandidateResult>;
}

interface RawRow {
  C01?: string | number;
  C02?: string;
  C03?: string;
  C05?: string;
  C06?: string;
  C07?: string;
  C08?: string;
}

function parseVotes(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseShare(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseElected(row: RawRow): boolean | null {
  const sk = (row.C07 ?? "").toLowerCase();
  const en = (row.C08 ?? "").toLowerCase();
  if (sk.includes("zvolen") || en === "elected") return true;
  if (sk === "" && en === "") return null;
  return false;
}

function parseRows(rows: RawRow[]): Record<number, CandidateResult> {
  const byBallot: Record<number, CandidateResult> = {};
  for (const row of rows) {
    const ballot = Number(row.C01);
    if (!Number.isFinite(ballot)) continue;
    byBallot[ballot] = {
      ballotNumber: ballot,
      votes: parseVotes(row.C05),
      voteShare: parseShare(row.C06),
      elected: parseElected(row),
    };
  }
  return byBallot;
}

function resultUrls(input: {
  kind: RaceKind;
  municipalityCode: string | null;
  district: number | null;
}): string[] {
  const { kind, municipalityCode, district } = input;
  if (kind === "mayor" && municipalityCode) {
    return [`${OSO}/json/tab05/${municipalityCode}.json`];
  }
  if (kind === "municipal_council" && municipalityCode) {
    const urls = [`${OSO}/json/tab06e/${municipalityCode}.json`];
    if (district != null) {
      urls.unshift(`${OSO}/json/tab06e${district}/${municipalityCode}.json`);
    }
    return urls;
  }
  if (kind === "regional_governor") {
    return [`${OSK}/json/tab06b/${NITRA_KRAJ}.json`];
  }
  if (kind === "regional_council" && district != null) {
    return [
      `${OSK}/json/tab09b/${district}.json`,
      `${OSK}/json/tab04b/${district}.json`,
    ];
  }
  return [];
}

function dateUrl(kind: RaceKind): string {
  return kind.startsWith("regional")
    ? `${OSK}/json/dateSK.json`
    : `${OSO}/json/dateSK.json`;
}

async function readLatestSnapshot(
  url: string,
): Promise<{ payload: unknown; retrievedAt: Date } | null> {
  const row = await db
    .selectFrom("election_result_snapshot")
    .select(["payload", "retrieved_at"])
    .where("url", "=", url)
    .orderBy("retrieved_at", "desc")
    .executeTakeFirst();
  if (!row) return null;
  return { payload: row.payload, retrievedAt: row.retrieved_at };
}

async function storeSnapshot(
  url: string,
  bytes: Buffer,
  httpStatus: number,
  payload: unknown,
): Promise<void> {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await db
    .insertInto("election_result_snapshot")
    .values({
      url,
      sha256,
      payload: jsonb(payload),
      http_status: httpStatus,
    })
    .onConflict((oc) => oc.columns(["url", "sha256"]).doNothing())
    .execute();
}

async function fetchJson(
  url: string,
): Promise<
  | { ok: true; status: number; bytes: Buffer; json: unknown }
  | { ok: false; status: number }
> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 404) return { ok: false, status: 404 };
    if (!res.ok) return { ok: false, status: res.status };
    const bytes = Buffer.from(await res.arrayBuffer());
    const json = JSON.parse(bytes.toString("utf8")) as unknown;
    return { ok: true, status: res.status, bytes, json };
  } catch {
    return { ok: false, status: 0 };
  }
}

async function fetchUpdatedAt(kind: RaceKind): Promise<string | null> {
  const res = await fetchJson(dateUrl(kind));
  if (!res.ok || !Array.isArray(res.json)) return null;
  const first = res.json[0];
  return typeof first === "string" ? first : null;
}

function rowsFromPayload(payload: unknown): RawRow[] | null {
  if (!Array.isArray(payload)) return null;
  if (payload.length === 0) return [];
  if (typeof payload[0] !== "object" || payload[0] === null) return null;
  return payload as RawRow[];
}

/**
 * Live 2026 results for one race. Short cache; falls back to the last stored
 * snapshot when volbysr.sk is unreachable. Missing JSON means counting.
 */
export async function getRaceResults(input: {
  kind: RaceKind;
  electionCode: string;
  municipalityCode: string | null;
  district: number | null;
}): Promise<RaceResults | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("results", `results:${input.electionCode}:${input.kind}`);

  if (input.electionCode !== "OSO2026" && input.electionCode !== "VUC2026") {
    return null;
  }

  const urls = resultUrls(input);
  if (!urls.length) return null;

  const updatedAt = await fetchUpdatedAt(input.kind);
  let lastUrl = urls[0]!;
  let saw404 = false;
  let sawError = false;

  for (const url of urls) {
    lastUrl = url;
    const live = await fetchJson(url);
    if (live.ok) {
      const rows = rowsFromPayload(live.json);
      if (rows === null) continue;
      await storeSnapshot(url, live.bytes, live.status, live.json);
      const byBallot = parseRows(rows);
      const hasVotes = Object.values(byBallot).some((r) => r.votes != null);
      return {
        status: hasVotes ? "live" : "counting",
        sourceUrl: url,
        updatedAt,
        fromCache: false,
        byBallot,
      };
    }
    if (live.status === 404) {
      saw404 = true;
      continue;
    }
    sawError = true;
    const cached = await readLatestSnapshot(url);
    if (cached) {
      const rows = rowsFromPayload(cached.payload) ?? [];
      const byBallot = parseRows(rows);
      const hasVotes = Object.values(byBallot).some((r) => r.votes != null);
      return {
        status: hasVotes ? "cached" : "counting",
        sourceUrl: url,
        updatedAt: cached.retrievedAt.toISOString(),
        fromCache: true,
        byBallot,
      };
    }
  }

  // Table not published yet → counting. Total outage with no snapshot → unavailable.
  if (saw404 && !sawError) {
    return {
      status: "counting",
      sourceUrl: lastUrl,
      updatedAt,
      fromCache: false,
      byBallot: {},
    };
  }

  return {
    status: "unavailable",
    sourceUrl: lastUrl,
    updatedAt: null,
    fromCache: false,
    byBallot: {},
  };
}

/** Attribution link for the Metodika / race footnote. */
export function resultsPortalUrl(kind: RaceKind): string {
  return kind.startsWith("regional") ? `${OSK}/sk/` : `${OSO}/sk/`;
}
