import { type Kysely, sql } from "kysely";

// Core model from specs/koho-volim: sources and immutable snapshots, elections,
// territory, people, candidacies and facts.
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS unaccent`.execute(db);
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`.execute(db);

  // unaccent() is not IMMUTABLE, so wrap it for use in indexes.
  await sql`
    CREATE FUNCTION immutable_unaccent(text) RETURNS text
      LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
      AS $$ SELECT public.unaccent('public.unaccent', $1) $$
  `.execute(db);

  await sql`
    CREATE TABLE source (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text NOT NULL UNIQUE,
      name text NOT NULL,
      base_url text NOT NULL,
      kind text NOT NULL CHECK (kind IN ('primary', 'secondary'))
    )
  `.execute(db);

  await sql`
    CREATE TABLE source_snapshot (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      source_id uuid NOT NULL REFERENCES source (id),
      url text NOT NULL,
      retrieved_at timestamptz NOT NULL DEFAULT now(),
      sha256 text NOT NULL,
      content_type text,
      storage_key text NOT NULL,
      http_status integer NOT NULL,
      UNIQUE (url, sha256)
    )
  `.execute(db);

  await sql`
    CREATE TABLE pipeline_run (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      stage text NOT NULL,
      started_at timestamptz NOT NULL DEFAULT now(),
      finished_at timestamptz,
      status text NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'succeeded', 'failed')),
      stats jsonb NOT NULL DEFAULT '{}'
    )
  `.execute(db);

  await sql`
    CREATE TABLE election (
      code text PRIMARY KEY,
      kind text NOT NULL CHECK (kind IN ('municipal', 'regional')),
      held_on date NOT NULL
    )
  `.execute(db);

  await sql`
    CREATE TABLE municipality (
      code text PRIMARY KEY,
      name text NOT NULL,
      slug text NOT NULL UNIQUE,
      district_name text NOT NULL,
      district_code text NOT NULL,
      region_code text NOT NULL
    )
  `.execute(db);
  await sql`
    CREATE INDEX municipality_name_trgm ON municipality
      USING gin (immutable_unaccent(lower(name)) gin_trgm_ops)
  `.execute(db);

  await sql`
    CREATE TABLE electoral_district (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      election_code text NOT NULL REFERENCES election (code),
      scope text NOT NULL CHECK (scope IN ('municipal', 'regional')),
      municipality_code text REFERENCES municipality (code),
      region_code text,
      number integer NOT NULL,
      seats integer,
      municipality_codes text[] NOT NULL DEFAULT '{}'
    )
  `.execute(db);
  await sql`
    CREATE UNIQUE INDEX electoral_district_unique ON electoral_district
      (election_code, scope, coalesce(municipality_code, ''), coalesce(region_code, ''), number)
  `.execute(db);

  await sql`
    CREATE TABLE race (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      election_code text NOT NULL REFERENCES election (code),
      kind text NOT NULL CHECK (kind IN
        ('mayor', 'municipal_council', 'regional_governor', 'regional_council')),
      municipality_code text REFERENCES municipality (code),
      region_code text,
      electoral_district_id uuid REFERENCES electoral_district (id),
      seats integer,
      slug text NOT NULL UNIQUE
    )
  `.execute(db);

  await sql`
    CREATE TABLE person (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      given_name text NOT NULL,
      family_name text NOT NULL,
      normalised_name text NOT NULL,
      slug text NOT NULL UNIQUE,
      age_2026 integer NOT NULL
    )
  `.execute(db);
  await sql`
    CREATE INDEX person_name_trgm ON person USING gin (normalised_name gin_trgm_ops)
  `.execute(db);

  await sql`
    CREATE TABLE candidacy (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      person_id uuid REFERENCES person (id),
      race_id uuid NOT NULL REFERENCES race (id),
      ballot_number integer,
      given_name text NOT NULL,
      family_name text NOT NULL,
      titles_before text,
      titles_after text,
      age integer,
      occupation text,
      party_label text,
      residence_municipality text,
      elected boolean,
      votes integer,
      snapshot_id uuid NOT NULL REFERENCES source_snapshot (id),
      match_reason jsonb,
      UNIQUE (race_id, ballot_number, given_name, family_name)
    )
  `.execute(db);
  await sql`CREATE INDEX candidacy_person ON candidacy (person_id)`.execute(db);
  await sql`
    CREATE INDEX candidacy_party_trgm ON candidacy
      USING gin (immutable_unaccent(lower(party_label)) gin_trgm_ops)
  `.execute(db);

  await sql`
    CREATE TABLE fact (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      person_id uuid NOT NULL REFERENCES person (id),
      type text NOT NULL,
      payload jsonb NOT NULL,
      occurred_from date,
      occurred_to date,
      source_id uuid NOT NULL REFERENCES source (id),
      source_url text NOT NULL,
      snapshot_id uuid NOT NULL REFERENCES source_snapshot (id),
      method text NOT NULL CHECK (method IN ('register', 'scrape', 'transcript', 'ai')),
      match_reason jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);
  await sql`CREATE INDEX fact_person_type ON fact (person_id, type)`.execute(
    db,
  );

  await sql`
    CREATE TABLE source_outcome (
      person_id uuid NOT NULL REFERENCES person (id),
      source_id uuid NOT NULL REFERENCES source (id),
      pipeline_run_id uuid NOT NULL REFERENCES pipeline_run (id),
      status text NOT NULL CHECK (status IN ('found', 'not_found', 'source_unavailable')),
      checked_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (person_id, source_id, pipeline_run_id)
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table of [
    "source_outcome",
    "fact",
    "candidacy",
    "person",
    "race",
    "electoral_district",
    "municipality",
    "election",
    "pipeline_run",
    "source_snapshot",
    "source",
  ]) {
    await sql`DROP TABLE IF EXISTS ${sql.table(table)}`.execute(db);
  }
  await sql`DROP FUNCTION IF EXISTS immutable_unaccent(text)`.execute(db);
}
