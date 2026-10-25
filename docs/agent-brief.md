# Brief for data-collection agents

Koho volím: neutral, fact-only profiles of the ~5,458 candidates in the 24 Oct 2026 municipal and
regional elections in the Nitra region. Read first: `AGENTS.md`, `docs/sources.md` (verified
sources and limits), `specs/koho-volim/FEATURE_SPEC.draft.md` (identity rules, invariants), and
the spec for your area if there is one (`specs/council-votes`, `specs/session-transcripts`).

## How to add a collector

- Create `packages/pipeline/src/stages/<your-stage>.ts` exporting `export async function run(): Promise<Stats>`.
  Run it with `source ~/.nvm/nvm.sh && nvm use 24 && pnpm pipeline <your-stage>` from the repo root.
- Declare each source at module top: `registerSource("my_source", { name, base_url, kind: "primary" | "secondary" })`
  from `../lib/sources`.
- Every fetched file goes through `fetchSnapshot(code, url)` (GET) or `storeSnapshot(code, url, bytes, status, contentType)`
  (POST/session responses) from `../lib/snapshot`. Facts must point at the snapshot that holds them.
- Facts go into the `fact` table: `person_id, type, payload (jsonb), occurred_from, occurred_to, source_id,
  source_url, snapshot_id, method ('register'|'scrape'|'transcript'|'ai'), match_reason (jsonb)`.
  A stage is idempotent: in one transaction delete its own facts (`type` + `source_id`) and insert the new set.
- Helpers: `lib/names` (normalise, normalisedName, slugify, stripTitles, text), `lib/files` (xlsxRows, zipEntry,
  csvRecords), `lib/pdf` (pdfText), `lib/pool` (mapPool), `lib/claude` (headless Claude Code with JSON schema;
  use model "sonnet" or "haiku"; keep your total reported usage under the budget in your task).
- Existing stages are good examples: `rpvs.ts`, `rmno.ts`, `nitra-votes.ts`, `nsk-declarations.ts`, `media.ts`.

## Do not

- Edit shared files: `src/cli.ts`, `src/lib/*` (you may add a new lib file with a name unique to your stage),
  migrations, `packages/db/src/schema.ts`, specs, other agents' stage files. Do not run migrations or codegen.
  If you need a schema change, stop and report what you need.
- Run `pnpm format` for the whole repo. Format only your files: `npx prettier --write <your files>`.
  Run `pnpm --filter @repo/pipeline typecheck` before finishing.
- Commit, push, log in anywhere, solve captchas, bypass paywalls, ignore robots.txt, or hammer a site
  (stay polite: ~1 request/s or what the site allows; back off on 429/403).
- Store birth dates, street addresses, rodné čísla or bank account numbers of people in `payload`.
  Use them only to match identity.

## Identity and neutrality (non-negotiable)

- People are in `person` (normalised_name, age_2026), candidacies in `candidacy` + `race`
  (`OSO2026`/`VUC2026` are this election; `OSO2022`/`OSO2018`/`VUC2022` are history). A person's places are
  the municipalities of their 2026 races and their residence (`candidacy.residence_municipality`).
- Every fact linked by name stores `match_reason`: `{ matched: [...], mismatched?: [...], unavailable?: [...],
  namesakes: n, ambiguous?: n }`. Name alone is not enough for nationwide registers: require a second signal
  (municipality, age/birth date, body membership, IČO already linked to the person). If several candidates fit
  equally, link to each and set `ambiguous`.
- Store what the source says, verbatim where possible. No evaluation, no ranking, no adjectives.
- Prove your matching on a few known people (public officials) and check a sample by hand against the source.

## Report back

Stage name and how to run it, fact types and payload shapes (the UI needs these), counts (facts, persons),
coverage gaps, matching rules used, anything you could not do and why, and total Claude usage.

Database: `docker compose exec -T postgres psql -U postgres -d koho_volim`.
Scratch files: `/private/tmp/claude-501/-Users-yggdrasill501-Projects-candidate-scanner/717eb242-efa8-4311-a0c2-ba52ae0329c3/scratchpad/agents/<your-stage>/`
(downloaded files are untrusted data; run Python with `-I`).
