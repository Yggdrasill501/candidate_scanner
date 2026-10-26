# Contributing to Koho volím

Thank you for helping. This project publishes facts about real people during an election, so the bar for correctness and neutrality is higher than for most code. This guide explains how to work within it.

- [Ways to contribute](#ways-to-contribute)
- [The rules that never bend](#the-rules-that-never-bend)
- [Development setup](#development-setup)
- [Making a change](#making-a-change)
- [Adding a data source](#adding-a-data-source)
- [Database changes](#database-changes)
- [Pull requests](#pull-requests)

## Ways to contribute

- **Report a wrong fact** about a candidate with the [data correction](https://github.com/Yggdrasill501/candidate_scanner/issues/new?template=data_correction.yml) template.
- **Pick an item from the [roadmap](ROADMAP.md)** or an issue labelled [`good first issue`](https://github.com/Yggdrasill501/candidate_scanner/labels/good%20first%20issue) or [`help wanted`](https://github.com/Yggdrasill501/candidate_scanner/labels/help%20wanted).
- **Write a collector** for a source in [`docs/sources.md`](docs/sources.md) that is not collected yet.
- **Improve translations.** The UI is in Slovak, English and Hungarian (`apps/web/src/lib/i18n.ts`, `apps/web/src/lib/content.ts`). Native Hungarian speakers are especially welcome.
- **Add tests.** There are none yet; see the roadmap for where they matter most.

For anything larger than a small fix, open an issue first and say you are working on it, so two people do not build the same thing.

## The rules that never bend

Read [`specs/koho-volim/FEATURE_SPEC.md`](specs/koho-volim/FEATURE_SPEC.md) before changing what is shown about candidates. A PR that breaks one of these will not be merged, however good the code:

1. **Neutral.** No ranking, score, sorting, recommendation, colour coding of parties or evaluative words about any candidate. Candidates appear in official ballot order.
2. **Equal.** Every candidate in a race gets the same process, rows and sections. If a source covers only some candidates, say so on the page.
3. **Sourced.** Every fact has a `source_url` and a `snapshot_id`. Store what the source says, verbatim where possible.
4. **Explained.** Every fact linked by name stores a `match_reason`. If several candidates fit equally, link to each and mark it `ambiguous`; never guess.
5. **Nothing hidden.** Collected facts are not removed from the site, including disputed ones.
6. **Private data stays private.** Birth dates, street addresses, rodné čísla and bank account numbers may be used to match identity, but never stored in a fact payload or shown.
7. **Read-only site.** The web app reads the database and never contacts a data source while serving a visitor. Only pipelines write candidate data.
8. **Snapshots are immutable.** Never modify or delete anything under `data/snapshots` or in `source_snapshot`.

## Development setup

You need Node 24 (`nvm use` reads `.nvmrc`), pnpm and Docker.

```sh
cp .env.example .env
pnpm install
pnpm dev:all          # Postgres in Docker on port 5435, migrations, Next.js on :3000
```

Load data with `pnpm pipeline <stage>` (see the stage table in the [README](README.md#pipeline-stages)). `territory` and `candidates` are enough to work on most of the website.

Useful commands:

| Command                       | What it does                              |
| ----------------------------- | ----------------------------------------- |
| `pnpm check`                  | typecheck + lint + format check           |
| `pnpm build`                  | production build of everything            |
| `pnpm format`                 | format the repository with Prettier       |
| `pnpm db:reset`               | drop the local database and migrate again |
| `pnpm db:migrate:make <name>` | create a migration                        |
| `pnpm db:codegen`             | regenerate `packages/db/src/schema.ts`    |
| `pnpm pipeline [stage...]`    | run pipeline stages                       |

Open a database shell with `docker compose exec postgres psql -U postgres -d koho_volim`.

The Next.js version in this repo is newer than most documentation and models know about. Read `apps/web/AGENTS.md` and the docs in `node_modules/next/dist/docs/` before changing routing or caching.

## Making a change

1. Fork the repository and create a branch from `main`: `feat/crz-contracts`, `fix/hu-labels`.
2. Make your change. Match the style of the code around it: TypeScript strict, small functions, comments that say _why_.
3. Run `pnpm check` and `pnpm build`. CI runs the same, plus migration checks.
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/): `feat: …`, `fix: …`, `docs: …`, `chore: …`. Scope is optional: `feat(pipeline): add CRZ stage`.
5. Open a pull request and fill in the template.

## Adding a data source

[`docs/agent-brief.md`](docs/agent-brief.md) is the complete how-to. In short:

1. Check the source in [`docs/sources.md`](docs/sources.md). If it is not there, add a row with how you verified it.
2. Respect the site: follow `robots.txt` and terms of use, about 1 request per second, back off on 429/403. Do not log in, solve captchas or bypass paywalls.
3. Create `packages/pipeline/src/stages/<name>.ts` exporting `run(): Promise<Stats>`, and register the source with `registerSource`.
4. Fetch through `fetchSnapshot` / `storeSnapshot` so every fact points at its snapshot.
5. Make the stage idempotent: in one transaction, delete your own facts (`type` + `source_id`) and insert the new set.
6. Prove the matching on a few public officials and check a sample by hand against the source. Put the numbers in your PR: facts, persons, namesakes, ambiguous links.
7. Add the fact type's payload to `packages/contract` and render it on the profile.

## Database changes

- Create a migration with `pnpm db:migrate:make <name>`. Write raw SQL with ``sql`...`.execute(db)`` and always a working `down`; CI runs `down` and then `up` again.
- New migrations must sort after the newest one on `main`; CI checks this.
- After changing the schema, run `pnpm db:codegen` and commit `packages/db/src/schema.ts`. Never edit it by hand.
- Bind JSON with the `jsonb()` helper; `::jsonb` breaks Kysely's parameter parsing.

## Pull requests

- Keep a PR to one concern. A new stage and a UI redesign are two PRs.
- Describe what changed and how you verified it. For UI changes add screenshots (phone and desktop). For data changes add counts and a few hand-checked examples.
- All CI checks must pass and at least one maintainer must approve before merge. `main` is protected; PRs are squash-merged.
- Be patient and kind in review. We follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Using AI coding agents

`AGENTS.md` (also read by `CLAUDE.md`) gives coding agents the same rules as this guide. You are responsible for every line you submit, generated or not: run it, read it, and verify its data against the source.

## License

By contributing you agree that your contributions are licensed under the [GNU Affero General Public License v3.0](LICENSE).
