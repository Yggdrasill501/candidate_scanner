import { type Kysely, sql } from "kysely";

/** Immutable JSON payloads from volbysr.sk for 2026 live results (web fallback). */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE election_result_snapshot (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      url text NOT NULL,
      retrieved_at timestamptz NOT NULL DEFAULT now(),
      sha256 text NOT NULL,
      payload jsonb NOT NULL,
      http_status integer NOT NULL,
      UNIQUE (url, sha256)
    )
  `.execute(db);
  await sql`
    CREATE INDEX election_result_snapshot_url_retrieved_idx
      ON election_result_snapshot (url, retrieved_at DESC)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS election_result_snapshot`.execute(db);
}
