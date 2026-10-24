# Session Transcripts (YouTube) Specification

> Purpose: This document declares how Koho volím collects transcripts of council sessions and candidates' own YouTube channels, attributes speech to candidates, and shows statements on profiles. Every decision is final.

## Overview

Councils in the Nitra region stream their sessions to YouTube. A single session runs up to 12 hours; the Nitra city channel alone holds 111 session recordings (~800 hours). These recordings are the richest public record of what elected officials actually say.

This feature turns those recordings into searchable, timestamped transcripts, identifies who is speaking from the chair's announcements ("Slovo má pán poslanec Štefek"), and stores each candidate's speeches as **statement** facts. Every statement links to the exact second of the original video, is shown verbatim (machine transcription, marked as such) and states how it was attributed to the person.

No video file is ever downloaded or stored. Where YouTube provides Slovak captions, only the caption text is fetched. Where it does not, the audio stream is piped directly into a local Whisper model and only the resulting text is kept.

## Product Integration

- Builds on the launch spec (`specs/koho-volim`): statements are a new `fact` type (`statement`) for existing `person` records; every rule there (snapshots, match reasons, nothing hidden, no external calls at request time) applies.
- Shares sessions, agenda items and topics with the Council Votes spec (`specs/council-votes`). Statements are displayed in that spec's **Hlasovania a výroky** section, grouped by topic next to the person's votes.
- Statements from a candidate's own channel (not a council session) appear in the same section under **Mimo zasadnutí** (outside sessions).

## Scope

| Source                                                                               | Discovery rule                                                                                                                                                                  |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NSK (Nitriansky samosprávny kraj)                                                    | Official channel, confirmed by a link from unsk.sk                                                                                                                              |
| 7 district towns: Nitra, Nové Zámky, Komárno, Levice, Topoľčany, Šaľa, Zlaté Moravce | Official channel, confirmed by a link from the town's website or channel name equal to "Mesto X"                                                                                |
| Any other Nitra-region municipality that streams                                     | YouTube search "zasadnutie zastupiteľstva {obec}"; included only when the channel is linked from the municipality's website or its name equals the municipality's official name |
| Candidates' own channels                                                             | Included only when linked from the candidate's official website or confirmed public Facebook page; stored with match reason                                                     |

Time window: every video available on these channels.

Session videos are selected by title matching `zasadnut|zastupiteľst|rokovan` (case- and diacritics-insensitive). Videos not matching are excluded unless the operator adds them to the include list for that channel. On candidates' own channels, every video is in scope.

## Interaction Design

Statements appear in the **Hlasovania a výroky** section (defined in `specs/council-votes`). Each statement is shown as:

```
„Tento úver mesto zadlží na ďalších desať rokov a…“            ▶ 2:14:08
30. zasadnutie MZ Nitra · 29. 5. 2025 · bod: Mat. č. 887/2025
Automatický prepis (YouTube titulky) — môže obsahovať chyby
Priradenie: predsedajúci ohlásil „pán poslanec Vančo“ · priezvisko + člen MZ Nitra 2022–2026
```

- ▶ opens YouTube at that second in a new tab.
- Text is exactly what the transcript says. The site never corrects, paraphrases or shortens a quote beyond trimming it at sentence boundaries to at most 600 characters, with "…" marking the cut. The full speaker turn is available via "Celé vystúpenie".
- Transcript method label: "YouTube titulky" or "Prepis: Whisper".

Profile summary counts: "Vystúpil 46× na 31 zasadnutiach (2022–2026)", per term.

Summary caps: per term, one statement per topic (newest first), at most **10 for the current term (2022–2026)** and **5 per older term**. "Zobraziť všetky výroky (N)" opens the full chronological list. Nothing is hidden.

A session page (`/{lang}/zasadnutie/{slug}`) shows the session's agenda items, the full searchable transcript with speaker labels and timestamps, and links to its votes.

## Terminology

| Term             | User-Facing (SK) | DB/Code                   | Definition                                                                |
| ---------------- | ---------------- | ------------------------- | ------------------------------------------------------------------------- |
| **Channel**      | Kanál            | `yt_channel`              | A YouTube channel in scope.                                               |
| **Video**        | Záznam           | `yt_video`                | One YouTube video.                                                        |
| **Session**      | Zasadnutie       | `session`                 | One council meeting (shared with council-votes); may span several videos. |
| **Transcript**   | Prepis           | `transcript`              | Timestamped text of one video, from captions or Whisper.                  |
| **Speaker turn** | Vystúpenie       | `speaker_turn`            | A continuous span of a transcript spoken by one speaker.                  |
| **Statement**    | Výrok            | `fact` (type `statement`) | A speaker turn attributed to a person.                                    |
| **Attribution**  | Priradenie       | `match_reason`            | How a speaker turn was attributed to a person.                            |
| **Agenda item**  | Bod programu     | `agenda_item`             | Shared with council-votes.                                                |

## User Roles & Permissions

Same as launch spec: visitors read; the operator runs pipelines from the CLI. No other roles.

## User Flows

### Flow 1: Read a candidate's statements

**Entry Point**: Profile → Hlasovania a výroky.

**Steps**:

1. Visitor expands a topic.
2. Each agenda item lists the person's votes and statements on it.
3. Visitor clicks ▶ → YouTube opens at the timestamp.
4. Visitor clicks "Celé vystúpenie" → the full speaker turn expands inline.

### Flow 2: Read a session

**Entry Point**: Session link on any statement or vote.

**Steps**: Visitor sees agenda, transcript with speaker labels, search-in-transcript box, and links to vote records.

### Flow 3: Operator collects transcripts

**Entry Point**: `pnpm pipeline transcripts [--channel <id>]`.

**Steps**:

1. **Discover** channels per the scope rules; store with discovery reason.
2. **List** videos on each channel's Videos and Live tabs; select session videos by title rule and include list.
3. **Check captions** from video metadata (no download). Record `has_sk_captions`.
4. **Fetch captions** (Slovak original auto-captions preferred, then Slovak manual captions) as VTT. Snapshot the raw file.
5. **Whisper** for videos without Slovak captions: stream best audio from YouTube → ffmpeg → whisper.cpp (`large-v3-turbo`, language `sk`) running locally; nothing is written to disk except the resulting transcript. Snapshot the transcript text.
6. **Segment** speaker turns (see Attribution).
7. **Link** turns to agenda items (see Agenda Linking).
8. **Create** `statement` facts for turns attributed to persons.
9. **Regenerate** AI summaries for affected persons (launch spec rules).

**Error Handling**:

- YouTube rate-limits or blocks: back off exponentially (start 60 s, max 1 h); after 5 failures for a video, mark `blocked` and continue. Blocked caption fetches are retried through an Apify YouTube transcript actor, capped at $10 per pipeline run.
- Whisper fails on a video: mark `transcription_failed`; the session page shows "Prepis sa nepodarilo vytvoriť" and the video link.
- Video removed from YouTube after collection: transcript and statements stay; the ▶ link shows "Video už nie je dostupné na YouTube" and the session page keeps the transcript snapshot.

## Attribution

1. **Chair announcements** mark speaker changes. A rule-based pass finds phrases such as "slovo má", "nech sa páči", "faktická poznámka", "s faktickou", "pán/pani poslanec/poslankyňa X", "pán primátor", "pán viceprimátor". An AI pass (fixed prompt, recorded `prompt_version`) then splits the transcript into speaker turns using those announcements and returns, per turn, the announced name text and the evidence span.
2. **Name to person**: the announced name (usually surname, sometimes with first name) is matched against the members of that body in that term, taken from election results (council members) and the office holder (mayor/chair). Match reason records: announced text, matched attributes (`surname`, `given_name`, `body_member`, `term`), and number of members sharing the surname.
3. If exactly one member matches, the turn is attributed with that reason. If several match, the turn is attributed to each with reason "nejednoznačné priradenie: N členov s priezviskom X", consistent with the launch rule that every match is shown with its reason.
4. Turns with no announced speaker, or by people who are not members (city staff, public), are kept in the transcript with the label "Nepriradený rečník" and create no statement facts.
5. On a candidate's own channel, all speech in the video is attributed to the channel's owner with reason "vlastný kanál kandidáta"; videos with obvious other speakers are not split further.

## Agenda Linking

A speaker turn is linked to the agenda item being discussed when the chair or speaker announces it: material number ("materiál číslo 887", "mat. č. 887/2025") or agenda point ("bod číslo 5"). The link holds until the next announcement. The agenda itself (items, material numbers, titles, topic) comes from the council-votes pipeline for that session. Turns before the first announcement, or in "Rôzne"/"Interpelácie", link to those agenda items when they exist in the agenda, otherwise to none and appear under **Mimo bodov programu**.

## Data Model

Extends the launch data model.

**yt_channel** — `id` (YouTube channel ID), `title`, `owner_kind` (`body` | `candidate`), `body_id` (nullable), `person_id` (nullable), `discovery_reason` (jsonb), `discovered_at`.

**yt_video** — `id` (YouTube video ID), `channel_id`, `title`, `published_at`, `duration_s`, `has_sk_captions`, `status` (`listed` | `transcribed` | `blocked` | `transcription_failed` | `removed`), `session_id` (nullable), `part` (order within a multi-video session).

**transcript** — `id`, `video_id`, `method` (`yt_captions` | `whisper`), `model` (nullable), `snapshot_id`, `language`, `created_at`.

**transcript_segment** — `transcript_id`, `idx`, `start_s`, `end_s`, `text`.

**speaker_turn** — `id`, `transcript_id`, `start_s`, `end_s`, `announced_name`, `evidence_text`, `agenda_item_id` (nullable), `prompt_version`.

**fact (type `statement`)** — payload: `{ speaker_turn_id, video_id, start_s, end_s, text, excerpt, agenda_item_id, transcript_method }`; `method` = `transcript`; `match_reason` = attribution.

Session, agenda item and topic tables are defined in `specs/council-votes`.

Snapshots: raw caption VTT files and Whisper outputs are stored as `source_snapshot`s. No audio or video is stored.

## State Diagram

```
yt_video: listed ──captions──▶ transcribed
          listed ──whisper───▶ transcribed
          listed ──5 failures▶ blocked ──apify ok──▶ transcribed
          listed ──whisper error▶ transcription_failed
          any    ──video gone──▶ removed (transcript kept)
```

## Key Design Decisions

| Decision                                                | Rationale                                                                                      |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Never download video; audio streamed into local Whisper | Free, no storage, no redistribution of media.                                                  |
| Captions first, Whisper only where missing              | Captions cost seconds; Whisper costs hours of local compute.                                   |
| Verbatim quotes, marked as machine transcription        | Editing quotes would put words in people's mouths; marking errors as possible keeps it honest. |
| Every quote links to the exact second                   | Anyone can verify by listening.                                                                |
| Attribution from chair announcements, with reason       | Councils announce every speaker; the reason makes attribution checkable.                       |
| Ambiguous attribution shown to all matches with reason  | Same "show all with reason" rule as the launch spec.                                           |
| One quote per topic per term in summary; all browsable  | Equal treatment between talkative and quiet members without hiding anything.                   |
| Apify only as blocked-fetch fallback, capped            | Keeps within the ~$100 Apify credit.                                                           |

## Invariants

1. No video or audio file is persisted.
2. Every statement has a video ID and start timestamp, and links to YouTube at that second.
3. Statement text is verbatim transcript text; trimming happens only at sentence boundaries and is marked with "…".
4. Every statement shows its transcript method and its attribution reason.
5. Every member of a body goes through the same pipeline for every session of that body.
6. A transcript snapshot is never modified; re-transcription creates a new transcript.

## Authors

- Filip Zitny
- Claude (Opus 5.5) — interview and drafting
