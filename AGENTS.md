# Koho volím

## Stack

Turborepo and pnpm (workspaces + catalog); Next.js (App Router), React and Tailwind CSS 4 in `apps/web`; Postgres with Kysely in `packages/db`; shared types in `packages/contract`. TypeScript everywhere, strict.

## Layout

| Path                | What it is                                                   |
| ------------------- | ------------------------------------------------------------ |
| `apps/web`          | Next.js app. `@/*` maps to `apps/web/src/*`.                 |
| `packages/db`       | Kysely client (`db`), migrations, generated `src/schema.ts`. |
| `packages/contract` | Types shared between apps. No runtime dependencies.          |
| `packages/pipeline` | Batch data pipelines (`pnpm pipeline [stage...]`).           |
| `specs/`            | Feature specs (`FEATURE_SPEC.draft.md` until reviewed).      |
| `docs/sources.md`   | Verified public data sources and their limits.               |

Internal packages are named `@repo/<name>`, export TypeScript source directly (`"exports": { ".": "./src/index.ts" }`) and have no build step.

## Environment

One `.env` at the repository root, copied from `.env.example`. `apps/web/next.config.ts` and `packages/db/kysely.config.ts` load it; do not add per-app `.env` files. New variables go in `.env.example` with a comment, and in `turbo.json` `env` if a build reads them.

## Database

- `pnpm db:up` starts Postgres (docker compose), `pnpm db:migrate` applies migrations.
- `pnpm db:migrate:make <name>` creates a migration in `packages/db/migrations`. Write raw SQL with `sql\`...\`.execute(db)`, and always a working `down`.
- After changing the schema, run `pnpm db:codegen` and commit `packages/db/src/schema.ts`. Never edit it by hand. CI fails if it drifts.
- Bind JSON with the `jsonb()` helper; `::jsonb` breaks Kysely's parameter parsing.

## Data pipeline

- Stages run in order: `territory` (municipalities, elections), `candidates` (2026 MV SR lists), `history` (2018–2022 results via Wayback). `pnpm pipeline` runs all; `pnpm pipeline history` runs one.
- Every fetched file is stored content-addressed under `data/snapshots` (gitignored) and recorded in `source_snapshot`; facts point at their snapshot. Never modify or delete snapshots.
- The website only reads the database. Pipelines are the only writers of candidate data.
- Linking by name always stores a `match_reason`; ambiguous matches link to every candidate. Birth dates and street addresses from registers are used for matching only and are never stored on public-facing rows.
- Read `specs/koho-volim/FEATURE_SPEC.draft.md` before changing what is shown about candidates: neutrality rules (ballot order, no rankings, nothing hidden) are invariants.

## Commands

`pnpm dev:all` (db up, migrate, dev), `pnpm check` (typecheck + lint + format check), `pnpm build`, `pnpm format`.

Before calling work done, run `pnpm check` and `pnpm build`.
