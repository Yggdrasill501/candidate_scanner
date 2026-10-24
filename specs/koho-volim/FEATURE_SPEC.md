# Koho volím — Launch Version Specification

> Purpose: This document declares the desired state of the launch version of Koho volím, a public, neutral, fact-only website about every candidate in the 2026 municipal and regional elections in the Nitra self-governing region. Every decision is final. Items not built in this version are listed explicitly under "Not in This Version".

## Overview

Koho volím lets a voter in the Nitra region see exactly who is on their ballot and what is publicly recorded about each candidate. It covers every candidate in the Nitra region running in the 24 October 2026 elections: municipal council (poslanec obecného/mestského zastupiteľstva), mayor (starosta/primátor), regional council (poslanec zastupiteľstva NSK) and regional governor (predseda NSK). That is ~5,460 distinct people across 354 municipalities in 7 districts (okresy).

The site states facts and links their sources. It never ranks, scores, endorses or characterises candidates. Every candidate goes through the same collection process and is shown with the same sections and fields, in official ballot order. Where nothing is found, the site says so explicitly ("Nenájdené"), so absence of data is visible rather than hidden. Nothing about a candidate is hidden once collected.

Data is collected by batch pipelines into Postgres. The website only reads from the database; it never fetches external sources while a visitor waits. Every fact keeps a link to its public source and to an immutable stored snapshot of what that source said when collected. The launch version contains: candidate lists, election history 2010–2022, business roles from RPVS and ORSR, outbound research links and an AI summary built only from stored facts. Facebook, YouTube, council votes and media are described briefly as follow-up fact types that plug into the same model.

## Product Integration

This is a new product in an empty repository. There are no existing features to integrate with.

- **Entry point**: the homepage "Môj hlasovací lístok" (My ballot) picker. Name/party/municipality search sits directly below it. Profiles and race pages are also reachable by direct URL (shared links, search engines).
- **Patterns**: the codebase follows the `repo-init` house style: Turborepo + pnpm workspaces, Next.js App Router + React + Tailwind CSS 4 in `apps/web`, Postgres + Kysely (kysely-ctl migrations, kysely-codegen types) in `packages/db`, shared types in `packages/contract`. Pipelines live in `packages/pipeline` and run as CLI commands.
- **Future features** (Facebook, YouTube, council votes, media) add new fact types and new profile sections; they do not change the launch screens' structure.

## Interaction Design

The design is minimalist: white background (dark mode supported), one readable sans-serif typeface, generous spacing, no photos, no colour coding of parties, no icons that imply judgement. Mobile-first: most visitors arrive on phones.

### Homepage — My ballot

```
Koho volím                                    SK | EN | HU

Môj hlasovací lístok
[ Obec ▾  (type to filter: "Nitra") ]
[ Volebný obvod ▾ ]   Neviem → zobraziť všetky obvody

— alebo hľadaj kandidáta, stranu, obec —
[ 🔍                                    ]

Údaje o kandidátoch: MV SR, stav k 23. 10. 2026 · Metodika
```

- Selecting a municipality shows the electoral-district picker for its municipal council. If the municipality has only one municipal electoral district, the picker is skipped.
- "Neviem" (I don't know) shows all districts of that municipality, each labelled with its number and seat count. The site does not map addresses to districts.
- After selection, the ballot view lists the four races on that voter's ballot, each with candidate count:
  - Primátor/Starosta of the municipality
  - Poslanci MZ/OZ, the chosen district
  - Predseda NSK
  - Poslanci NSK, the regional electoral district containing the municipality
- Each race links to its race page.

### Race page (with comparison)

Header: race name, territory, number of seats, number of candidates, data date. Body: the comparison table, candidates in **ballot order** (official ballot number). Rows are identical for every candidate:

| Row                  | Content                                              |
| -------------------- | ---------------------------------------------------- |
| Meno                 | Full name with titles, links to profile              |
| Vek                  | Age as published                                     |
| Zamestnanie          | Occupation as published                              |
| Strana               | Party/coalition or "nezávislý kandidát" as published |
| Kandidoval / zvolený | Count of candidacies and elections won, 2010–2022    |
| Firmy                | Count of business roles found (RPVS + ORSR)          |
| Zhrnutie             | AI summary (first sentence, expandable)              |

On phones the table becomes a horizontally swipeable card per candidate with the same rows in the same order. Columns are not sortable.

### Candidate profile

Header: name with titles, age, and every 2026 candidacy of this person (a person can run in several races). Two tabs: **Prehľad** (sections, default) and **Časová os** (timeline).

Sections, always in this order, always present:

1. **Zhrnutie** — AI summary, labelled "Zhrnutie vygenerované AI z faktov nižšie", each sentence with footnote numbers linking to the facts it uses.
2. **Kandidatúry 2026** — every 2026 race with ballot number, party, occupation.
3. **Volebná história 2010–2022** — every past candidacy: year, body, territory, party, occupation then, elected or not, votes if available. Each linked candidacy shows its match reason.
4. **Firmy a funkcie** — every RPVS/ORSR role: organisation, IČO, role, valid from/to, source. Each with its match reason.
5. **Hlasovania a výroky** (`specs/council-votes`, `specs/session-transcripts`), **Sociálne siete**, **Médiá** — shown with "V príprave" (in preparation) in the launch version.
6. **Ďalší výskum** — outbound links (see below).
7. **Zdroje** — every source used on the page with retrieval date.

Empty sections that have been collected display "Nenájdené v: [source list]".

The **Časová os** tab lists the same facts chronologically (oldest first), each with its section label and source link.

### Match reason display

Facts linked to a person by name are never shown without saying why:

```
Firmy a funkcie
• Konateľ, ABC s.r.o., IČO 12345678 (2014 – dodnes)   [ORSR]
  Zhoda: meno ✔ · obec bydliska ✔ (Nitra) · rok narodenia: neuvedený v zdroji
• Spoločník, XYZ s.r.o., IČO 87654321 (2009 – 2016)   [ORSR]
  Zhoda: len meno · obec bydliska ✘ (Levice) · v kraji 3 kandidáti s týmto menom
```

### Search

One input; results grouped into **Kandidáti**, **Strany**, **Obce**. Matching ignores diacritics and case ("jan horvath" finds "Ján Horváth") and tolerates small typos. Party results open a list of that party's candidates in the region grouped by race. Municipality results open the ballot view for that municipality. Empty result: "Nič sme nenašli pre „…“. Skontroluj pravopis alebo vyber obec vyššie."

### Methodology page (Metodika)

Static page in all three languages: list of sources with links and retrieval dates, matching rules, AI-summary rules, what is not covered and why, and the statement that the site does not endorse or rank anyone.

### Error experience

- Unknown profile/race URL: 404 page with the search box.
- Database unavailable: a static error page "Stránka je dočasne nedostupná" with the data source links; no partial or stale-mixed pages.
- A source that failed during collection for a candidate: the section shows "Zdroj [name] nebol dostupný pri zbere (dátum)" instead of "Nenájdené".

## Terminology

| Term                   | User-Facing (SK)              | DB/Code              | Definition                                                                                                             |
| ---------------------- | ----------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Person**             | Kandidát                      | `person`             | One real human, possibly with many candidacies across elections.                                                       |
| **Candidacy**          | Kandidatúra                   | `candidacy`          | One person on one race's official candidate list.                                                                      |
| **Election**           | Voľby                         | `election`           | One election event: `OSO2026`, `VUC2026`, `OSO2022`, `VUC2022`, `OSO2018`, `VUC2017`, `OSO2014`, `VUC2013`, `OSO2010`. |
| **Race**               | Voľba (e.g. "Primátor Nitry") | `race`               | One contest within an election: kind + territory + electoral district.                                                 |
| **Race kind**          | Druh voľby                    | `race.kind`          | `mayor`, `municipal_council`, `regional_governor`, `regional_council`.                                                 |
| **Ballot**             | Hlasovací lístok              | (derived)            | The set of races a voter in a given municipality + district votes in.                                                  |
| **Municipality**       | Obec                          | `municipality`       | Obec or mesto, keyed by official code.                                                                                 |
| **Electoral district** | Volebný obvod                 | `electoral_district` | District within a municipality or the region, per election.                                                            |
| **Fact**               | Fakt / údaj                   | `fact`               | One atomic claim about a person, with source and snapshot.                                                             |
| **Source**             | Zdroj                         | `source`             | A public origin of data (e.g. ORSR).                                                                                   |
| **Snapshot**           | —                             | `source_snapshot`    | Immutable stored copy of a fetched document, with SHA-256 hash.                                                        |
| **Match reason**       | Zhoda                         | `match_reason`       | Structured record of which attributes linked a record to a person.                                                     |
| **AI summary**         | Zhrnutie                      | `ai_summary`         | 3–5 sentence generated summary, footnoted to fact IDs.                                                                 |
| **Pipeline run**       | —                             | `pipeline_run`       | One execution of a collection or generation stage.                                                                     |

## User Roles & Permissions

### Visitor

- Can view every page, in SK, EN or HU.
- Can search, select a ballot, compare candidates, open outbound links.
- Cannot create, change or comment on any content.
- Does not log in; no accounts exist.

### Operator

- Runs pipelines and deployments from the command line with database credentials.
- Has no web admin interface in this version.

### Key Principle

> The public site is strictly read-only; all data enters only through operator-run pipelines that record their sources.

## User Flows

### Flow 1: See my ballot

**Entry Point**: Homepage.

**Preconditions**: Candidate data loaded.

**Steps**:

1. Visitor types into the municipality picker; the list filters as they type (diacritics-insensitive).
2. Visitor selects a municipality.
3. System shows the district picker (skipped if one district) with a "Neviem" option.
4. Visitor selects a district or "Neviem".
5. System shows the four races on that ballot with candidate counts; with "Neviem", the municipal-council race is shown once per district.
6. Visitor opens a race.

**Result**: Race page with comparison table. The ballot selection is kept in the URL (`/sk/obec/nitra?obvod=3`) so it can be shared and bookmarked.

**Error Handling**: A municipality with no candidates in a race shows that race with "V tejto voľbe nie je zaregistrovaný žiadny kandidát."

### Flow 2: Search

**Entry Point**: Search box on homepage or header of every page.

**Steps**:

1. Visitor types at least 2 characters.
2. System returns grouped results (Kandidáti, Strany, Obce), max 10 per group, with "zobraziť všetky".
3. Visitor opens a result.

**Result**: Profile, party list or ballot view.

**Error Handling**: No results → empty-state message (see Interaction Design).

### Flow 3: Read a candidate profile

**Entry Point**: Race page, search result, or direct URL `/sk/kandidat/{slug}`.

**Steps**:

1. System shows the Prehľad tab with all sections.
2. Visitor clicks a footnote in the summary → page scrolls to and highlights the referenced fact.
3. Visitor opens Časová os tab → same facts chronologically.
4. Visitor clicks a source link → source opens in a new tab.

**Result**: Visitor has seen every collected fact with its source.

### Flow 4: Switch language

**Steps**: Visitor clicks SK/EN/HU → same page in the other locale (`/en/...`, `/hu/...`). UI labels change; candidate data (names, occupations, parties, organisation names, source titles) stays verbatim in Slovak; the AI summary appears in the chosen language.

**Default**: `/` redirects to `/sk`, `/en` or `/hu` by the browser's `Accept-Language`, falling back to `/sk`.

### Flow 5: Further research

**Entry Point**: "Ďalší výskum" section of a profile.

**Steps**: Visitor clicks a prefilled outbound link; it opens in a new tab.

Links (generated at render time from name and municipality, never fetched by the server):

- Finstat person search
- ORSR search by person name
- CRZ full-text search
- RPVS search
- Google News search ("Meno Priezvisko" + municipality)
- Facebook search ("Meno Priezvisko" + municipality)

### Flow 6: Operator loads and publishes data

**Entry Point**: CLI, `pnpm pipeline <stage>`.

**Steps** (each stage idempotent, each records a `pipeline_run`):

1. `candidates` — download the four MV SR XLSX files, snapshot them, filter to Nitra region (districts Komárno, Levice, Nitra, Nové Zámky, Šaľa, Topoľčany, Zlaté Moravce and the Nitriansky samosprávny kraj), load municipalities, districts, races, persons, candidacies.
2. `history` — fetch 2010–2022 results for Nitra-region municipalities and NSK from the Statistical Office; when the Statistical Office is unreachable for an election, fetch SME results pages instead and mark those facts `secondary`. Link past candidacies to persons.
3. `business` — query RPVS OData and ORSR person search for every person; store roles with match reasons.
4. `summaries` — generate AI summaries in SK, EN, HU for every person whose fact set changed.
5. `publish` — revalidate affected pages on Vercel.

**Result**: Database populated for every Nitra-region candidate; site shows the new data.

**Error Handling**: A failed fetch is retried 3 times with backoff, then recorded as a `source_unavailable` outcome for that person and source; the run continues. A stage that fails as a whole leaves earlier published data untouched.

## Identity Rules

1. **Within 2026**: candidacies with identical normalised full name and identical age are the same person if they are in the same municipality (municipal races) or the municipal-race municipality equals the regional candidate's municipality of permanent residence (regional races).
2. **History (2010–2022)**: a past candidacy links to a person when normalised full name matches, the municipality matches, and the age then equals 2026 age minus elapsed years (±1). If exactly one person qualifies, the reason is "meno + obec + vek". If several qualify, the candidacy is linked to each of them with reason "nejednoznačná zhoda: N osôb" and appears on each profile.
3. **Business roles**: a register record links to a person when the normalised full name matches. Every link stores which attributes matched (name, municipality of address, birth date/year where the source provides it) and how many 2026 Nitra-region candidates share the name. All links are shown; none is hidden.
4. Titles are not used for matching (they change over time).

## Data Model

All tables live in `packages/db` (Kysely migrations). IDs are UUIDs; timestamps are UTC.

**source** — `id`, `code` (`minv_candidates`, `statistics_results`, `sme_results`, `rpvs`, `orsr`), `name`, `base_url`, `kind` (`primary` | `secondary`).

**source_snapshot** — `id`, `source_id`, `url`, `retrieved_at`, `sha256`, `content_type`, `storage_key` (object storage path of the raw bytes), `http_status`. Never updated or deleted.

**election** — `code` (PK), `kind` (`municipal` | `regional`), `held_on`.

**municipality** — `code` (official code, PK), `name`, `slug`, `district_name`, `district_code`, `region_code`.

**electoral_district** — `id`, `election_code`, `scope` (`municipal` | `regional`), `municipality_code` (nullable), `number`, `seats`, `municipality_codes` (array: for regional districts, the municipalities it contains).

**race** — `id`, `election_code`, `kind`, `municipality_code` (nullable), `electoral_district_id` (nullable), `seats`, `slug`.

**person** — `id`, `given_name`, `family_name`, `normalised_name`, `slug`, `age_2026`.

**candidacy** — `id`, `person_id`, `race_id`, `ballot_number`, `titles_before`, `titles_after`, `age`, `occupation`, `party_label`, `residence_municipality` (nullable), `elected` (nullable boolean), `votes` (nullable int), `snapshot_id`, `match_reason` (jsonb).

**fact** — `id`, `person_id`, `type`, `payload` (jsonb, schema per type in `packages/contract`), `occurred_from`, `occurred_to` (nullable), `source_id`, `source_url`, `snapshot_id`, `method` (`register` | `scrape` | `transcript` | `ai`), `match_reason` (jsonb), `created_at`. Launch types: `business_role`. Follow-up types: `council_vote`, `attendance`, `statement`, `social_post`, `media_mention`.

**source_outcome** — `person_id`, `source_id`, `pipeline_run_id`, `status` (`found` | `not_found` | `source_unavailable`), `checked_at`. Drives "Nenájdené" vs "Zdroj nebol dostupný".

**ai_summary** — `person_id`, `lang` (`sk` | `en` | `hu`), `sentences` (jsonb: `[{text, fact_ids[], candidacy_ids[]}]`), `model`, `prompt_version`, `input_hash`, `generated_at`. Primary key (`person_id`, `lang`).

**pipeline_run** — `id`, `stage`, `started_at`, `finished_at`, `status`, `stats` (jsonb).

**analytics_event** — `id`, `visit_id`, `visitor_hash`, `event`, `path`, `lang`, `properties` (jsonb), `device_type`, `browser`, `os`, `country`, `referrer_host`, `created_at`. See Analytics.

**analytics_salt** — `day` (PK), `salt`. Row deleted when the day ends.

**match_reason** shape: `{ "matched": ["name","municipality","age"], "mismatched": ["municipality"], "unavailable": ["birth_year"], "namesakes": 3 }`.

Search uses Postgres `unaccent` + `pg_trgm` indexes on `person.normalised_name`, `candidacy.party_label` and `municipality.name`.

Deletion: nothing is deleted. A re-run that no longer finds a business role sets its `occurred_to`/status via a new fact version; the previous row remains with its snapshot.

## State Diagram

Pipeline run:

```
pending → running → succeeded
                 ↘ failed   (published data unchanged)
```

AI summary for a person:

```
missing → generated (input_hash = hash of person's facts + candidacies)
generated → regenerated   when input_hash changes on a later run
```

## AI Summary Rules

- Input: only that person's stored candidacies and facts (with IDs). No web access, no model knowledge.
- Output: 3–5 sentences, each referencing at least one fact or candidacy ID. A sentence without references is rejected and the generation retried; after 3 failures the summary is stored as the fixed template "Kandiduje v: … Volebná história: … Firmy: …" built without AI.
- Style: neutral, past/present tense statements of record; no adjectives of evaluation, no speculation, no comparison to other candidates. Namesake-reason facts are mentioned with their match qualifier.
- Same prompt, model and maximum length for every person. SK is generated first; EN and HU are generated from the same inputs, not translated from SK.
- Displayed with the label "Zhrnutie vygenerované AI z faktov nižšie" and footnotes.

## Analytics

First-party analytics stored in the project's own Postgres. No third-party analytics service, no cookies, no localStorage, no IP addresses stored. No consent banner is needed and no visitor is identified.

**Collection**: a small client script sends events to `POST /api/event`. The server enriches each event and writes one row to `analytics_event`:

- `visit_id` — random ID generated in page memory on first load, kept across in-app (client-side) navigation, lost on full reload or new tab. Used only to reconstruct navigation paths within a visit.
- `visitor_hash` — SHA-256 of (daily secret salt + IP + User-Agent). The salt is generated each day at 00:00 UTC, kept only in memory/DB for that day and then deleted, so hashes cannot be linked across days or reversed. Used only to count unique visitors per day.
- `device_type`, `browser`, `os` — parsed server-side from the User-Agent; the raw User-Agent is not stored.
- `country` — from Vercel's `x-vercel-ip-country` header.
- `referrer_host` — host part only.
- `path`, `lang`, `event`, `properties` (jsonb), `created_at`.

**Measured** (read with SQL queries): visitors per day, page views, devices, browsers, OS, countries, referrers, and navigation paths within a visit.

**Retention**: rows older than 13 months are deleted.

Events:

| Event                      | Properties                                                              |
| -------------------------- | ----------------------------------------------------------------------- |
| `ballot_selected`          | `municipality_code`, `district_number` or `unknown`                     |
| `search_performed`         | `query_length`, `results_count`, `result_group_clicked` (no query text) |
| `profile_viewed`           | `person_id`, `tab`                                                      |
| `race_viewed`              | `race_id`                                                               |
| `summary_footnote_clicked` | `person_id`                                                             |
| `outbound_link_clicked`    | `target` (`finstat`                                                     | `orsr` | `crz` | `rpvs` | `google_news` | `facebook`) |
| `page_view`                | —                                                                       |
| `language_switched`        | `from`, `to`                                                            |

## API Surface

Public read-only routes (Next.js App Router, locale prefix `sk` | `en` | `hu`):

| Route                            | Content                                                | Rendering                   |
| -------------------------------- | ------------------------------------------------------ | --------------------------- |
| `/{lang}`                        | Homepage / ballot picker                               | Static                      |
| `/{lang}/obec/{slug}?obvod={n}`  | Ballot view                                            | ISR, revalidated on publish |
| `/{lang}/volby/{race-slug}`      | Race page + comparison                                 | ISR                         |
| `/{lang}/kandidat/{person-slug}` | Profile                                                | ISR                         |
| `/{lang}/strana/{party-slug}`    | Party's candidates in region by race                   | ISR                         |
| `/{lang}/hladat?q=`              | Search results page                                    | Dynamic, DB read            |
| `/{lang}/metodika`               | Methodology                                            | Static                      |
| `GET /api/search?q=&lang=`       | Grouped search JSON for the live search box            | Dynamic, DB read            |
| `POST /api/event`                | Analytics event ingest (rate-limited per visitor hash) | Dynamic, DB write           |

Slugs are stable: `person.slug` = normalised name + municipality + disambiguating suffix when needed.

## Follow-up Fact Types (brief)

Each becomes its own spec; each adds facts of a new `type` to the same `fact` table, fills its "V príprave" section, and follows the same fairness rules (same collection per person in scope, per-era caps on the summary, everything browsable beyond the cap).

- **Council votes and attendance (`council_vote`, `attendance`)** — named roll-call records and attendance from minutes/voting PDFs of NSK and Nitra-region municipalities; key votes chosen by a published rule applied to the whole council.
- **Statements (`statement`)** — YouTube session recordings of NSK, the 7 district towns, every Nitra-region municipality that streams, and candidates' own channels; captions or speech-to-text, attributed to speakers via chair announcements; quotes linked to video timestamps.
- **Social posts (`social_post`)** — public Facebook pages of candidates (not personal profiles), collected with an automated browser for research; application to Meta Content Library filed in parallel.
- **Media (`media_mention`)** — national and regional outlets; syndicated copies collapsed into one; per-era caps; total count always shown.
- **Pre-1989 (ÚPN registers)** — requires a review process and is excluded until one exists.

## Key Design Decisions

| Decision                                             | Rationale                                                                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Batch pipelines into Postgres; site only reads DB    | Same process for every candidate, reproducible, fast, no live dependency on sources that block or rate-limit.                                           |
| Raw snapshots with SHA-256 kept forever              | Any fact can be traced to exactly what the source said on that date.                                                                                    |
| "My ballot" as primary entry                         | Voters compare within their own races; this removes most fame asymmetry between candidates.                                                             |
| Ballot order, no sorting                             | No implied ranking; mirrors the official ballot.                                                                                                        |
| All name-based matches shown, each with match reason | Nothing hidden, while namesakes are never presented as certain facts.                                                                                   |
| AI summary only from stored facts, footnoted         | Readability without unsourced claims.                                                                                                                   |
| UI translated, source data verbatim                  | Translations of official data could alter meaning.                                                                                                      |
| Free/open sources only                               | Anyone can verify every fact without paying.                                                                                                            |
| SME results as labelled fallback                     | History is shown even when the Statistical Office is unreachable, marked as secondary.                                                                  |
| No photos                                            | Uneven availability would treat candidates unequally; avoids licensing issues.                                                                          |
| First-party analytics in own Postgres                | Traffic, devices and flows without a third party, cookies or identifying anyone; daily-rotated salt makes unique-visitor counts unlinkable across days. |
| District picked manually                             | No public address→district dataset; a wrong automatic guess would show a wrong ballot.                                                                  |
| Stack per `repo-init`, Vercel + managed Postgres     | House style; a base for later pipelines.                                                                                                                |

## Not in This Version

These are excluded from this version by decision; they have no features, routes, tables or code here:

- Comments, disputes/fact-check requests, candidate right of reply and candidate verification.
- Review workflow and reviewer roles.
- Pre-1989 / ÚPN section.
- Photos.
- 2026 election results and post-election behaviour.
- Paid data sources (Finstat API, news search APIs).
- Regions other than Nitra.

## Invariants

1. Every displayed fact and candidacy has a source link and a stored snapshot.
2. Every fact linked by name displays its match reason.
3. Every candidate in a race is shown with the same rows and sections, in ballot order.
4. Collected data is never hidden from the public site.
5. The public site performs no request to an external data source while serving a visitor. Its only database writes are analytics events.
6. Every AI-summary sentence references at least one stored fact or candidacy.
7. The site contains no ranking, score, recommendation or evaluative language about any candidate.
8. Analytics never stores cookies, IP addresses, raw User-Agents, search text or any identifier that links a visitor across days.
9. Snapshots are never modified or deleted.

## Authors

- Filip Zitny
- Claude (Opus 5.5) — interview and drafting
