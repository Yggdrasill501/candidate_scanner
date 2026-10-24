# Council Votes & Decisions Specification

> Purpose: This document declares how Koho volím collects council decisions and named roll-call votes, links them to candidates, and shows every vote next to everything the person said on the same topic. Every decision is final.

## Overview

Municipal and regional councils decide budgets, loans, zoning and the sale of public property by vote. Many publish who voted how. Nitra city, for example, publishes a PDF per session listing every vote with its number, description, material number, counts and the names of members voting for, against, abstaining and not voting.

This feature collects those records, links each name to a candidate, assigns each agenda item to a topic, and shows on every profile a **Hlasovania a výroky** (Votes and statements) section: grouped by topic, every agenda item with the person's votes on it and everything they said about it in session (from `specs/session-transcripts`). The site places words and votes side by side and never judges whether they are consistent; the reader decides.

## Product Integration

- Builds on the launch spec (`specs/koho-volim`): votes become `council_vote` and `attendance` facts for existing `person` records; all launch invariants apply.
- Defines `body`, `term`, `session`, `agenda_item` and `topic`, which `specs/session-transcripts` reuses.
- Replaces the launch placeholders "Hlasovania" and "Výroky a vystúpenia" with the single section **Hlasovania a výroky**.
- Adds key-vote and attendance rows to the race comparison table for races where candidates are current members.

## Scope

Bodies, in this order:

1. Mestské zastupiteľstvo Nitra
2. Zastupiteľstvo Nitrianskeho samosprávneho kraja
3. Mestské zastupiteľstvá Nové Zámky, Komárno, Levice, Topoľčany, Šaľa, Zlaté Moravce
4. Every other Nitra-region municipality that publishes named votes, added one adapter at a time

Time window: every session for which the body publishes records online.

A body that does not publish named votes is listed with "Orgán nezverejňuje menovité hlasovanie" on the profiles of its members; its resolutions (uznesenia) and attendance are still collected when published.

## Interaction Design

### Profile section: Hlasovania a výroky

```
Hlasovania a výroky                     MZ Nitra 2022–2026 · účasť 94 %

▾ Rozpočet a financie (14 bodov)
   Mat. č. 887/2025 — Návrh na prijatie úveru na financovanie
   kapitálových výdavkov mesta Nitry 2025–2027
   30. zasadnutie · 29. 5. 2025                       [Hlasovania PDF] [Video]
     Povedal:
       „Tento úver mesto zadlží na ďalších desať rokov a…“    ▶ 2:14:08
     Hlasoval:
       #1 procedurálny návrh p. Kršiaka         PROTI     (18 : 3 : 4)
       #2 pozmeňovací návrh p. Vanča            ZA        (12 : 4 : 12)
       #3 uznesenie ako celok                   ZDRŽAL SA (17 : 3 : 5)
   Mat. č. 610/2024 — Rozpočet mesta na rok 2025 …
▸ Doprava (9 bodov)
▸ Územný plán a výstavba (6 bodov)
▸ Majetok mesta (11 bodov)
…
▸ Mimo bodov programu (statements not linked to an item)
```

- Topics are listed in fixed order; topics with no items for the person show "Žiadne body".
- Under each topic, agenda items newest first. Each item shows every vote taken on it and every statement the person made on it. Items where the person neither voted nor spoke are not listed under that person (they appear on the session page).
- Counts are shown as (za : proti : zdržali sa).
- Vote choices: **ZA**, **PROTI**, **ZDRŽAL SA**, **NEHLASOVAL** (present, did not vote), **NEPRÍTOMNÝ** (absent).
- Topic label carries "Téma priradená automaticky" on hover/tap.
- No colours or icons indicate good/bad; no consistency labels.

### Profile summary: key votes

The profile summary area shows the person's **key votes** and attendance. Key votes are chosen by one published rule applied to the whole council, so every member of a council is shown on the same set:

- the budget and its amendments (rozpočet, zmena rozpočtu),
- the final accounts (záverečný účet),
- the zoning plan and its amendments (územný plán),
- loans and credit (úver),
- sale, lease or transfer of the body's property (predaj, nájom, prevod majetku),
- any vote decided by a margin of 3 votes or fewer.

Only the final vote on each such item (resolution as a whole) counts as a key vote. The summary shows the 10 most recent key votes; "Všetky kľúčové hlasovania (N)" opens the full list.

Attendance: `present votes / votes held` per term, shown as a percentage with the raw numbers.

### Race comparison table additions

Two rows for every candidate in the race: **Účasť na hlasovaniach** (attendance % in their current body, or "nebol členom") and **Kľúčové hlasovania** (count with link). Rows are identical for all candidates; non-members show "—".

### Session page

`/{lang}/zasadnutie/{slug}`: date, number, type (riadne/mimoriadne), agenda items with material numbers and topics, every vote with full name lists per choice, links to source PDFs and videos, and the transcript (from session-transcripts).

## Terminology

| Term                | User-Facing (SK)      | DB/Code                       | Definition                                                    |
| ------------------- | --------------------- | ----------------------------- | ------------------------------------------------------------- |
| **Body**            | Zastupiteľstvo        | `body`                        | A council: municipal (MZ/OZ) or regional (NSK).               |
| **Term**            | Volebné obdobie       | `term`                        | A body's four-year term, e.g. 2022–2026.                      |
| **Member**          | Poslanec / poslankyňa | `body_member`                 | A person seated in a body for a term (from election results). |
| **Session**         | Zasadnutie            | `session`                     | One meeting of a body.                                        |
| **Agenda item**     | Bod programu          | `agenda_item`                 | One item discussed, usually with a material number.           |
| **Material number** | Mat. č.               | `agenda_item.material_number` | The council's document number, e.g. 887/2025.                 |
| **Vote**            | Hlasovanie            | `vote`                        | One numbered roll-call within a session.                      |
| **Vote kind**       | Druh hlasovania       | `vote.kind`                   | `procedural`, `amendment`, `resolution`, `other`.             |
| **Vote cast**       | Hlas                  | `vote_cast`                   | One member's choice in one vote.                              |
| **Topic**           | Téma                  | `topic`                       | Fixed category grouping agenda items.                         |
| **Key vote**        | Kľúčové hlasovanie    | (derived)                     | A resolution vote matching the published key-vote rule.       |
| **Attendance**      | Účasť                 | (derived)                     | Share of votes in which the member was present.               |

## Topics

Fixed list, same for every body:

1. Rozpočet a financie
2. Doprava
3. Územný plán a výstavba
4. Majetok mesta / kraja
5. Školstvo
6. Sociálne veci a zdravotníctvo
7. Životné prostredie
8. Kultúra a šport
9. Správa mesta / kraja (personnel, rules of procedure, committees)
10. Ostatné

Each agenda item gets exactly one topic. Assignment: an AI classifier with a fixed prompt reads the item title and material text; the result, `prompt_version` and `method = ai` are stored. The topic list and the prompt are published on the Metodika page.

## User Roles & Permissions

Same as launch spec: visitors read; the operator runs pipelines from the CLI.

## User Flows

### Flow 1: See how a candidate voted and what they said on a topic

**Entry Point**: Profile → Hlasovania a výroky.

**Steps**:

1. Visitor expands a topic.
2. System shows agenda items newest first, each with the person's statements and votes.
3. Visitor clicks [Hlasovania PDF] → source PDF opens; [Video] or ▶ → YouTube at the timestamp.

**Result**: Visitor has every vote and every attributed statement of that person on that topic.

### Flow 2: Compare candidates on attendance and key votes

**Entry Point**: Race page comparison table.

**Steps**: Visitor reads Účasť and Kľúčové hlasovania rows; clicks a count → that candidate's key-vote list.

### Flow 3: Operator collects votes

**Entry Point**: `pnpm pipeline votes [--body <code>]`.

**Steps**:

1. **Members**: load each body's members per term from election results (launch history data) and record changes during the term (substitutes, resignations) from session records where published.
2. **Fetch** session records with the body's adapter (Nitra: per-session "Hlasovania" PDFs and zápisnice from nitra.sk). Snapshot every file.
3. **Parse** each PDF into votes: number, description, material number, kind, counts, and name lists per choice.
4. **Validate**: name-list lengths must equal stated counts; a mismatch is stored with `source_inconsistency = true` and shown as "Nesúlad v zdroji: počty a mená sa nezhodujú".
5. **Group** votes into agenda items by material number (or agenda point when no material number exists).
6. **Classify** agenda items into topics.
7. **Link** names to members (see Name Matching); members present in no list of a vote are recorded as `absent` for that vote.
8. **Create** `council_vote` facts per person per vote and `attendance` facts per person per term.
9. **Regenerate** AI summaries for affected persons.

**Error Handling**:

- A PDF that fails to parse: stored as snapshot, session marked `parse_failed`, listed in the pipeline report; the session page shows "Záznam hlasovania sa nepodarilo spracovať" with the PDF link.
- A body's website unreachable: retry 3× with backoff, then `source_unavailable` for that body in that run; previously collected data stays.

## Name Matching

Vote PDFs list members by first name and surname, without titles or age. A name links to a person when:

- normalised first name + surname equals a member of that body in that term (from election results), and
- that member is linked to a 2026 candidate (launch identity rules).

Match reason: `{ matched: ["given_name","surname","body_member","term"], namesakes: n }`. Members not running in 2026 are stored as `body_member` without a person profile; their votes appear on session pages only. A name with no member match (typo, name change) is stored as `unmatched_name` and listed on the session page as written in the source.

## Data Model

Extends the launch data model.

**body** — `id`, `code` (e.g. `mz_nitra`, `z_nsk`), `name`, `kind` (`municipal` | `regional`), `municipality_code` (nullable), `adapter`, `publishes_named_votes` (boolean).

**term** — `id`, `body_id`, `from`, `to`, `election_code`.

**body_member** — `id`, `term_id`, `given_name`, `family_name`, `person_id` (nullable), `seat_from`, `seat_to`, `match_reason`.

**session** — `id`, `body_id`, `term_id`, `number`, `kind` (`regular` | `extraordinary` | `constituent`), `held_on`, `slug`, `status` (`collected` | `parse_failed`).

**agenda_item** — `id`, `session_id`, `position`, `material_number` (nullable), `title`, `topic_code`, `topic_method`, `topic_prompt_version`.

**topic** — `code`, `name_sk`, `name_en`, `name_hu`, `position`.

**vote** — `id`, `session_id`, `agenda_item_id` (nullable), `number`, `description`, `kind`, `count_for`, `count_against`, `count_abstain`, `count_not_voting`, `count_present`, `is_key`, `source_inconsistency`, `snapshot_id`.

**vote_cast** — `vote_id`, `body_member_id` (nullable), `name_as_written`, `choice` (`for` | `against` | `abstain` | `not_voting` | `absent`).

**fact (type `council_vote`)** — payload `{ vote_id, choice }`; `method` = `register`.

**fact (type `attendance`)** — payload `{ term_id, present_votes, total_votes }`.

`is_key` is true when `vote.kind = resolution` and either the agenda item title matches the key-vote keywords listed above, or the vote was narrow. A vote is narrow when `|count_for − votes_needed| ≤ 3`, where `votes_needed` is the majority of present members (`floor(count_present / 2) + 1`) unless the source record states a different required majority.

## Key Design Decisions

| Decision                                                   | Rationale                                                         |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| Words and votes side by side, grouped by topic, no verdict | Shows the full record; consistency judgments are the reader's.    |
| Fixed topic list, AI-assigned, labelled and published      | Same grouping for every member; assignment method is transparent. |
| Key votes by one rule per council                          | Every member is shown on the same votes; no cherry-picking.       |
| Absent = not in any list of that vote                      | Derivable from the source without guessing.                       |
| Source inconsistencies stored and shown, not fixed         | The site reports what the source says.                            |
| Per-body adapters, starting with Nitra                     | Each municipality publishes in its own format.                    |

## Invariants

1. Every vote cast links to a source snapshot of the body's record.
2. Every member of a body is processed for every vote of that body; key-vote sets are identical for all members of a body and term.
3. The site never labels a person's statements and votes as consistent or inconsistent.
4. Source inconsistencies are displayed, never silently corrected.
5. Topic assignments always show that they were assigned automatically.

## Authors

- Filip Zitny
- Claude (Opus 5.5) — interview and drafting
