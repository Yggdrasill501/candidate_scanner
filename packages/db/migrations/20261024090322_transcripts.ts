import { type Kysely, sql } from "kysely";

// YouTube channels, videos and transcripts (specs/session-transcripts); parliament as a body.
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE body DROP CONSTRAINT body_kind_check`.execute(db);
  await sql`ALTER TABLE body ADD CONSTRAINT body_kind_check CHECK (kind IN ('municipal', 'regional', 'national'))`.execute(
    db,
  );

  await sql`
    CREATE TABLE yt_channel (
      id text PRIMARY KEY,
      title text NOT NULL,
      owner_kind text NOT NULL CHECK (owner_kind IN ('body', 'candidate')),
      body_id uuid REFERENCES body (id),
      person_id uuid REFERENCES person (id),
      discovery_reason jsonb NOT NULL,
      discovered_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE yt_video (
      id text PRIMARY KEY,
      channel_id text NOT NULL REFERENCES yt_channel (id),
      title text NOT NULL,
      published_at date,
      duration_s integer,
      has_sk_captions boolean,
      status text NOT NULL CHECK (status IN ('listed', 'transcribed', 'blocked', 'transcription_failed', 'removed')),
      session_id uuid REFERENCES session (id) ON DELETE SET NULL,
      part integer
    )
  `.execute(db);

  await sql`
    CREATE TABLE transcript (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      video_id text NOT NULL REFERENCES yt_video (id),
      method text NOT NULL CHECK (method IN ('yt_captions', 'whisper')),
      model text,
      snapshot_id uuid NOT NULL REFERENCES source_snapshot (id),
      language text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE transcript_segment (
      transcript_id uuid NOT NULL REFERENCES transcript (id) ON DELETE CASCADE,
      idx integer NOT NULL,
      start_s real NOT NULL,
      end_s real NOT NULL,
      text text NOT NULL,
      PRIMARY KEY (transcript_id, idx)
    )
  `.execute(db);

  await sql`
    CREATE TABLE speaker_turn (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      transcript_id uuid NOT NULL REFERENCES transcript (id) ON DELETE CASCADE,
      start_s real NOT NULL,
      end_s real NOT NULL,
      announced_name text,
      evidence_text text,
      agenda_item_id uuid REFERENCES agenda_item (id) ON DELETE SET NULL,
      prompt_version text
    )
  `.execute(db);
  await sql`CREATE INDEX speaker_turn_transcript ON speaker_turn (transcript_id)`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const t of [
    "speaker_turn",
    "transcript_segment",
    "transcript",
    "yt_video",
    "yt_channel",
  ]) {
    await sql`DROP TABLE IF EXISTS ${sql.table(t)}`.execute(db);
  }
  await sql`ALTER TABLE body DROP CONSTRAINT body_kind_check`.execute(db);
  await sql`ALTER TABLE body ADD CONSTRAINT body_kind_check CHECK (kind IN ('municipal', 'regional'))`.execute(
    db,
  );
}
