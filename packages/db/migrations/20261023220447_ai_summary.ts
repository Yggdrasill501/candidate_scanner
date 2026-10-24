import { type Kysely, sql } from "kysely";

// AI summaries per person and language (specs/koho-volim, AI Summary Rules).
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE ai_summary (
      person_id uuid NOT NULL REFERENCES person (id) ON DELETE CASCADE,
      lang text NOT NULL CHECK (lang IN ('sk', 'en', 'hu')),
      sentences jsonb NOT NULL,
      method text NOT NULL CHECK (method IN ('ai', 'template')),
      model text,
      prompt_version text NOT NULL,
      input_hash text NOT NULL,
      generated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (person_id, lang)
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS ai_summary`.execute(db);
}
