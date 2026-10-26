# Roadmap

Status as of 26 October 2026, two days after the election. The launch scope in [`specs/koho-volim`](specs/koho-volim/FEATURE_SPEC.md) is built and loaded for the Nitra region. This page lists what is done and what is left, so anyone can pick up a piece.

Each open item says where to start. Bigger items should become a GitHub issue before work begins; comment on the issue to claim it.

Legend: 🟢 done · 🟡 partial · ⚪ not started

## Done

### Data (Nitra region)

| Area                         | Stage(s)                | Coverage in the current build                                  |
| ---------------------------- | ----------------------- | -------------------------------------------------------------- |
| 🟢 Territory and elections   | `territory`             | 354 municipalities, 7 districts, 6 elections                   |
| 🟢 2026 candidates           | `candidates`            | 5,458 persons, 15,427 candidacies                              |
| 🟢 Election history          | `history`               | 2018–2022: 4,587 past candidacies for 2,910 persons            |
| 🟢 Business roles            | `rpvs`, `rpo`           | 16,814 roles for 3,492 persons                                 |
| 🟢 NGO roles                 | `rmno`                  | 1,585 roles for 1,012 persons                                  |
| 🟢 Asset declarations        | `nsk-declarations`      | NSK councillors (55 persons)                                   |
| 🟢 Council votes, attendance | `nitra-votes`, `topics` | Nitra city council 2022–2026: 111 sessions, 147,687 votes cast |
| 🟢 Media mentions            | `media`                 | 1,906 mentions for 524 persons                                 |
| 🟢 Fact-checks, watchdogs    | `demagog`, `tis`        | Demagog.sk; TIS monitoring of Nitra mayor and NSK chair races  |
| 🟢 Encyclopedia              | `wikipedia`             | 29 articles (sk, hu)                                           |
| 🟢 AI summaries              | `summaries`             | sk, en, hu for every person, footnoted to facts                |

### Website

- 🟢 Homepage with region map and municipality search
- 🟢 Ballot view per municipality, race pages with the comparison table in ballot order
- 🟢 Candidate profiles: sections, timeline tab, match reasons, sources
- 🟢 Party pages, candidate index, search (diacritics- and typo-tolerant, `pg_trgm`)
- 🟢 2026 results page and results on race pages
- 🟢 Methodology, sources and corrections pages
- 🟢 Slovak, English and Hungarian UI
- 🟢 404 and database-down error pages, `/api/health`

### Engineering

- 🟢 Content-addressed snapshots for every fetched file
- 🟢 CI: typecheck, lint, format, build, generated schema in sync, migrations reversible, migration order

## Left to do

### 1. Launch-spec gaps

These are things the launch spec requires that the code does not do yet. They come first.

| Status | Item                                     | Why it matters / where to start                                                                                                                                                                                                                                                                                 |
| :----: | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   🟡   | **2026 results as a pipeline stage**     | `apps/web/src/lib/results.ts` fetches volbysr.sk at request time, which breaks invariant 5 (no external requests while serving). Move fetching into `packages/pipeline/src/stages/results.ts`, write `candidacy.elected` / `candidacy.votes` and `election_result_snapshot`, and make the web read only the DB. |
|   ⚪   | **`source_outcome` rows**                | The web reads `source_outcome` to tell "Nenájdené" (not found) from "Zdroj nebol dostupný" (source unavailable), but no stage writes it, so the table is empty. Add a helper in `packages/pipeline/src/lib/` and call it from each per-person stage.                                                            |
|   ⚪   | **Privacy-preserving analytics**         | Spec: `analytics_event`, `analytics_salt`, `POST /api/event`, daily-rotated salt, no cookies. See [Analytics](specs/koho-volim/FEATURE_SPEC.md#analytics). Needs a migration and an API route.                                                                                                                  |
|   ⚪   | **`publish` stage**                      | Revalidate affected ISR pages after a pipeline run instead of redeploying.                                                                                                                                                                                                                                      |
|   🟡   | **History 2010 and 2014, regional 2013** | Only page shells are archived in the Wayback Machine. Options in [`docs/sources.md`](docs/sources.md): the 2010 Nitra PDF, or a freedom-of-information request (infozákon) to ŠÚ SR.                                                                                                                            |
|   🟡   | **Robots-compliant media outlets**       | `media-outlets` stage (TASR, STVR, SITA, NitraDen, …) is in progress.                                                                                                                                                                                                                                           |

### 2. Follow-up features (specs written)

| Status | Item                                                                                                                                                                                                                                 | Spec                                                                     |
| :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
|   🟡   | **Session transcripts** from YouTube recordings: captions via yt-dlp, Whisper for the rest, speaker attribution from the chair's announcements. Tables exist (`yt_channel`, `yt_video`, `transcript`, `speaker_turn`); no stage yet. | [`specs/session-transcripts`](specs/session-transcripts/FEATURE_SPEC.md) |
|   🟡   | **Council votes beyond Nitra city**: NSK, then Nové Zámky, Komárno, Levice, Topoľčany, Šaľa, Zlaté Moravce, then every municipality that publishes named votes. One adapter per body.                                                | [`specs/council-votes`](specs/council-votes/FEATURE_SPEC.md)             |
|   ⚪   | **Words next to votes**: link statements to agenda items via material numbers (mat. č.). Depends on transcripts.                                                                                                                     | both specs above                                                         |

### 3. More sources (verified, not yet collected)

All of these are rated USABLE or CAVEATS in [`docs/sources.md`](docs/sources.md). Each is a self-contained stage: a good way to start contributing. Follow [`docs/agent-brief.md`](docs/agent-brief.md).

- ⚪ **CRZ** public contracts (daily XML or the Slovensko.Digital datahub), linked by IČO already on a person
- ⚪ **Town registers** of contracts and invoices: Nitra, Levice, Komárno (CG eGOV); Šaľa, Topoľčany, Nové Zámky, Zlaté Moravce (Digitálne mesto)
- ⚪ **Campaign transparent accounts**: final reports are due 30–90 days after the vote, so between late November 2026 and late January 2027
- ⚪ **REPLIK** insolvency register
- ⚪ **ITMS** EU-funded projects by recipient IČO
- ⚪ **Professional registers**: lawyers (SAK), architects, auditors, notaries, university staff
- ⚪ **NR SR**: former MPs, with birth dates for identity (behind a strict WAF; throttle hard)
- ⚪ **Party donors** from annual reports (publish name, municipality and amount only)

### 4. Engineering

- ⚪ **Tests.** There are none yet; `turbo.json` already has a `test` task. Start with the pure functions where a bug changes who a fact is attached to: `lib/names` (normalisation, title stripping), the matching rules in `history`, `rpo`, `rpvs`, and the PDF parser in `nitra-votes`. Use fixtures cut from real snapshots.
- ⚪ **Snapshot storage.** Snapshots live on the operator's disk (`data/snapshots`). Move them to object storage so `storage_key` resolves for anyone and facts can be verified independently.
- ⚪ **Open data export.** Publish the fact set (with sources and match reasons) as CSV/JSON dumps.
- ⚪ **Accessibility and performance audit** of the map, comparison table and profiles on phones.
- ⚪ **Deployment guide.** Document production hosting (Neon config in `neon.ts`, Vercel notes in `.env.example`).

### 5. Beyond Nitra

- ⚪ **Other regions.** The core stages read one `REGION_CODE` (`packages/pipeline/src/lib/region.ts`), but several stages are Nitra-specific (`nitra-votes`, `nsk-declarations`) and the map geometry covers Nitra only. Making the region a run-time parameter is the first step.
- ⚪ **After the election.** The site now describes an election that has happened. Deciding what it becomes (an archive, or a record of the 2026–2030 councils) needs a short spec.

### Explicitly out of scope

Decided in the launch spec and not planned: photos, rankings or scores of any kind, paid data sources, candidate accounts or right-of-reply workflows, and pre-1989 ÚPN records until a review process exists. Facebook is deferred until its scope is decided (see [`docs/sources.md`](docs/sources.md#deferred)).
