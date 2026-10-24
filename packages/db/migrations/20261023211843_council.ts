import { type Kysely, sql } from "kysely";

// Council bodies, sessions, agenda items and roll-call votes (specs/council-votes).
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE topic (
      code text PRIMARY KEY,
      name_sk text NOT NULL,
      name_en text NOT NULL,
      name_hu text NOT NULL,
      position integer NOT NULL
    )
  `.execute(db);
  await sql`
    INSERT INTO topic (code, name_sk, name_en, name_hu, position) VALUES
      ('budget', 'Rozpočet a financie', 'Budget and finance', 'Költségvetés és pénzügyek', 1),
      ('transport', 'Doprava', 'Transport', 'Közlekedés', 2),
      ('planning', 'Územný plán a výstavba', 'Zoning and construction', 'Területrendezés és építkezés', 3),
      ('property', 'Majetok mesta / kraja', 'Public property', 'Városi / megyei vagyon', 4),
      ('education', 'Školstvo', 'Education', 'Oktatás', 5),
      ('social', 'Sociálne veci a zdravotníctvo', 'Social affairs and health', 'Szociális ügyek és egészségügy', 6),
      ('environment', 'Životné prostredie', 'Environment', 'Környezetvédelem', 7),
      ('culture', 'Kultúra a šport', 'Culture and sport', 'Kultúra és sport', 8),
      ('administration', 'Správa mesta / kraja', 'Administration', 'Városi / megyei igazgatás', 9),
      ('other', 'Ostatné', 'Other', 'Egyéb', 10)
  `.execute(db);

  await sql`
    CREATE TABLE body (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text NOT NULL UNIQUE,
      name text NOT NULL,
      kind text NOT NULL CHECK (kind IN ('municipal', 'regional')),
      municipality_code text REFERENCES municipality (code),
      adapter text NOT NULL,
      publishes_named_votes boolean NOT NULL
    )
  `.execute(db);

  await sql`
    CREATE TABLE term (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      body_id uuid NOT NULL REFERENCES body (id),
      starts_on date NOT NULL,
      ends_on date,
      election_code text NOT NULL REFERENCES election (code),
      UNIQUE (body_id, election_code)
    )
  `.execute(db);

  await sql`
    CREATE TABLE body_member (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      term_id uuid NOT NULL REFERENCES term (id),
      given_name text NOT NULL,
      family_name text NOT NULL,
      normalised_name text NOT NULL,
      person_id uuid REFERENCES person (id),
      candidacy_id uuid REFERENCES candidacy (id),
      match_reason jsonb,
      UNIQUE (term_id, normalised_name)
    )
  `.execute(db);

  await sql`
    CREATE TABLE session (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      body_id uuid NOT NULL REFERENCES body (id),
      term_id uuid REFERENCES term (id),
      number integer,
      kind text NOT NULL CHECK (kind IN ('regular', 'extraordinary', 'constituent')),
      held_on date NOT NULL,
      slug text NOT NULL UNIQUE,
      status text NOT NULL CHECK (status IN ('collected', 'parse_failed')),
      snapshot_id uuid REFERENCES source_snapshot (id),
      UNIQUE (body_id, held_on)
    )
  `.execute(db);

  await sql`
    CREATE TABLE agenda_item (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id uuid NOT NULL REFERENCES session (id) ON DELETE CASCADE,
      position integer NOT NULL,
      material_number text,
      title text NOT NULL,
      topic_code text REFERENCES topic (code),
      topic_method text,
      topic_prompt_version text
    )
  `.execute(db);
  await sql`CREATE INDEX agenda_item_session ON agenda_item (session_id)`.execute(
    db,
  );

  await sql`
    CREATE TABLE vote (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id uuid NOT NULL REFERENCES session (id) ON DELETE CASCADE,
      agenda_item_id uuid REFERENCES agenda_item (id) ON DELETE CASCADE,
      number integer NOT NULL,
      description text NOT NULL,
      kind text NOT NULL CHECK (kind IN ('procedural', 'amendment', 'resolution', 'other')),
      count_for integer,
      count_against integer,
      count_abstain integer,
      count_not_voting integer,
      count_present integer,
      is_key boolean NOT NULL DEFAULT false,
      source_inconsistency boolean NOT NULL DEFAULT false,
      snapshot_id uuid NOT NULL REFERENCES source_snapshot (id),
      UNIQUE (session_id, number)
    )
  `.execute(db);

  await sql`
    CREATE TABLE vote_cast (
      vote_id uuid NOT NULL REFERENCES vote (id) ON DELETE CASCADE,
      body_member_id uuid REFERENCES body_member (id),
      name_as_written text NOT NULL,
      choice text NOT NULL CHECK (choice IN ('for', 'against', 'abstain', 'not_voting', 'absent'))
    )
  `.execute(db);
  await sql`CREATE INDEX vote_cast_vote ON vote_cast (vote_id)`.execute(db);
  await sql`CREATE INDEX vote_cast_member ON vote_cast (body_member_id)`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table of [
    "vote_cast",
    "vote",
    "agenda_item",
    "session",
    "body_member",
    "term",
    "body",
    "topic",
  ]) {
    await sql`DROP TABLE IF EXISTS ${sql.table(table)}`.execute(db);
  }
}
