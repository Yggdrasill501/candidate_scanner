# Koho volím

Neutral, fact-only profiles of every candidate in the 24 October 2026 municipal and regional elections in the Nitra region: who is on your ballot, their election history, and public records, each with a link to its source.

- Specs: `specs/koho-volim` (launch), `specs/session-transcripts`, `specs/council-votes`
- Sources: `docs/sources.md`

## Run locally

```sh
pnpm install
pnpm db:up && pnpm db:migrate
pnpm pipeline            # territory, candidates, history
pnpm dev                 # http://localhost:3000
```
