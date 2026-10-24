import { db, jsonb, sql } from "@repo/db";
import { normalise } from "../lib/names";
import { pdfText } from "../lib/pdf";
import { mapPool } from "../lib/pool";
import type { Stats } from "../lib/run";
import { fetchSnapshot, type Snapshot } from "../lib/snapshot";
import { sourceId } from "../lib/sources";

const MEDIA_API = "https://nitra.sk/wp-json/wp/v2/media";
const NITRA = "500011";
const BODY_CODE = "mz_nitra";
/** The 2022–2026 term starts with the constituent session. */
const TERM_2022_START = "2022-11-15";

type Choice = "for" | "against" | "abstain" | "not_voting" | "absent";
const CHOICE_LABELS: Record<string, Choice> = {
  za: "for",
  proti: "against",
  "zdrzali sa": "abstain",
  nehlasovali: "not_voting",
  nepritomni: "absent",
};

interface ParsedVote {
  number: number;
  description: string;
  counts: Partial<
    Record<"za" | "proti" | "zdrzali sa" | "nehlasovali" | "pritomni", number>
  >;
  lists: { choice: Choice; text: string }[];
}

interface ParsedSession {
  number: number | null;
  kind: "regular" | "extraordinary" | "constituent";
  heldOn: string;
  votes: ParsedVote[];
}

/** Parses one "Hlasovania z N. zasadnutia" PDF (pdftotext -layout). */
export function parseVotes(text: string): ParsedSession | null {
  const flat = text.replace(/\s+/g, " ");
  const date = flat.match(/konaného dňa ?(\d{1,2})\. ?(\d{1,2})\. ?(\d{4})/);
  if (!date) return null;
  const heldOn = `${date[3]}-${date[2]!.padStart(2, "0")}-${date[1]!.padStart(2, "0")}`;
  const head = flat.slice(0, date.index);
  const kind = /ustanovujúc/i.test(head)
    ? "constituent"
    : /mimoriadn/i.test(head)
      ? "extraordinary"
      : "regular";
  const number = Number(head.match(/zo?\s+(\d+)\.\s/)?.[1]) || null;

  const votes: ParsedVote[] = [];
  let vote: ParsedVote | null = null;
  let mode: "description" | "counts" | "list" = "description";
  let choice: Choice | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line || /^\d+$/.test(line) || line === "POKRAČOVANIE") continue;
    const start = line.match(/^Číslo hlasovania:\s*(\d+)\s*(?:[–-]\s*(.*))?$/);
    if (start) {
      vote = {
        number: Number(start[1]),
        description: start[2] ?? "",
        counts: {},
        lists: [],
      };
      votes.push(vote);
      mode = "description";
      continue;
    }
    if (!vote) continue;
    // Document footers ("Spracovala:", "ref. organizačný") end a name list.
    if (
      mode === "list" &&
      /^(Spracoval|Overil|ref\.|Za správnosť|V Nitre|Zapísal)/i.test(line)
    ) {
      mode = "description";
      choice = null;
      continue;
    }
    if (/^Poslanci .*hlasovali nasledovne/.test(line)) {
      mode = "counts";
      continue;
    }
    const count = line.match(
      /^(Za|Proti|Zdržali sa|Nehlasovali|Prítomní|Neprítomní):\s*(\d+)$/,
    );
    if (count) {
      const key = normalise(count[1]!) as keyof ParsedVote["counts"];
      vote.counts[key] = Number(count[2]);
      mode = "counts";
      continue;
    }
    const header = line.match(
      /^(Za|Proti|Zdržali sa|Nehlasovali|Neprítomní):\s*(.*)$/,
    );
    if (header && mode !== "description") {
      choice = CHOICE_LABELS[normalise(header[1]!)] ?? null;
      mode = "list";
      if (header[2] && choice) vote.lists.push({ choice, text: header[2] });
      continue;
    }
    if (mode === "description" && vote.lists.length === 0)
      vote.description += (vote.description ? " " : "") + line;
    else if (mode === "list" && choice) vote.lists.push({ choice, text: line });
  }
  return { number, kind, heldOn, votes };
}

/** Splits a run of names using known member names (longest match first). */
export function splitNames(
  text: string,
  known: Map<string, string>,
): { name: string; key: string | null; variant?: boolean }[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: { name: string; key: string | null; variant?: boolean }[] = [];
  let unknown: string[] = [];
  const flush = () => {
    for (let i = 0; i < unknown.length; i += 2) {
      out.push({ name: unknown.slice(i, i + 2).join(" "), key: null });
    }
    unknown = [];
  };
  for (let i = 0; i < words.length;) {
    let matched = 0;
    for (const len of [4, 3, 2]) {
      const key = normalise(words.slice(i, i + len).join(" "));
      if (i + len <= words.length && known.has(key)) {
        matched = len;
        break;
      }
    }
    // Name change (e.g. an added surname): first name + last surname of three words.
    const variant =
      !matched && i + 3 <= words.length
        ? normalise(`${words[i]} ${words[i + 2]}`)
        : null;
    if (matched) {
      flush();
      const key = normalise(words.slice(i, i + matched).join(" "));
      out.push({ name: words.slice(i, i + matched).join(" "), key });
      i += matched;
    } else if (variant && known.has(variant)) {
      flush();
      out.push({
        name: words.slice(i, i + 3).join(" "),
        key: variant,
        variant: true,
      });
      i += 3;
    } else {
      unknown.push(words[i]!);
      i++;
    }
  }
  flush();
  return out;
}

/**
 * Names of one choice list. In multi-column layouts a long name can wrap into the next row with
 * other names in between, so unmatched fragments are joined and matched again.
 */
export function listNames(text: string, known: Map<string, string>) {
  const result = splitNames(text, known);
  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const a = result[i]!;
      const b = result[j]!;
      if (a.key || b.key) continue;
      const key = normalise(`${a.name} ${b.name}`);
      if (known.has(key)) {
        result[i] = { name: `${a.name} ${b.name}`, key };
        result.splice(j, 1);
        break;
      }
    }
  }
  // Unmatched fragments that are not shaped like a name ("MESTO NITRA", "mat. č.") are page text
  // that leaked into the list, not people.
  return result.filter(
    (n) =>
      n.key ||
      n.name
        .split(" ")
        .every((w) => /^\p{Lu}\p{Ll}+(-\p{Lu}\p{Ll}+)?$/u.test(w)),
  );
}

/** Joins consecutive lines of the same choice, so names wrapped across lines stay whole. */
function joinLists(lists: ParsedVote["lists"]): ParsedVote["lists"] {
  const out: ParsedVote["lists"] = [];
  for (const l of lists) {
    const last = out.at(-1);
    if (last && last.choice === l.choice) last.text += ` ${l.text}`;
    else out.push({ ...l });
  }
  return out;
}

function voteKind(
  description: string,
): "procedural" | "amendment" | "resolution" | "other" {
  const d = normalise(description);
  if (
    /procedural|zaradit|vypustit|program|navrhovej komisie|overovatel|poverenym|prezentaci/.test(
      d,
    )
  )
    return "procedural";
  if (/pozmenovac|pozmenujuc|doplnujuc|doplnovac/.test(d)) return "amendment";
  if (/ako o celku|uznesen|ako o prvom a ako o celku/.test(d))
    return "resolution";
  return "other";
}

const KEY_TITLE =
  /rozpoct|zaverecn\w* uct|uzemn\w* plan|uver|predaj|predat|najom|prenajom|prevod\w* majet|zamen/;

/**
 * Nitra city council named votes, both terms (2018–2022, 2022–2026). Members come from the
 * election results; every member of a term is processed for every vote of that term.
 */
export async function nitraVotes(): Promise<Stats> {
  const source = await sourceId("nitra_votes");

  // --- Body and terms.
  const body = await db
    .insertInto("body")
    .values({
      code: BODY_CODE,
      name: "Mestské zastupiteľstvo Nitra",
      kind: "municipal",
      municipality_code: NITRA,
      adapter: "nitra_pdf",
      publishes_named_votes: true,
    })
    .onConflict((oc) => oc.column("code").doUpdateSet({ adapter: "nitra_pdf" }))
    .returning("id")
    .executeTakeFirstOrThrow();
  const terms: Record<"OSO2018" | "OSO2022", string> = {
    OSO2018: "",
    OSO2022: "",
  };
  for (const [code, from, to] of [
    ["OSO2018", "2018-12-01", TERM_2022_START],
    ["OSO2022", TERM_2022_START, null],
  ] as const) {
    const t = await db
      .insertInto("term")
      .values({
        body_id: body.id,
        election_code: code,
        starts_on: from,
        ends_on: to,
      })
      .onConflict((oc) =>
        oc
          .columns(["body_id", "election_code"])
          .doUpdateSet({ starts_on: from, ends_on: to }),
      )
      .returning("id")
      .executeTakeFirstOrThrow();
    terms[code] = t.id;
  }

  // --- Members: the term's own council candidacies (elected first), then Nitra council
  // candidacies from other elections, which covers substitutes (náhradníci) who joined later.
  const candidacies = await db
    .selectFrom("candidacy")
    .innerJoin("race", "race.id", "candidacy.race_id")
    .leftJoin("fact", (j) =>
      j
        .on("fact.type", "=", "past_candidacy")
        .on(sql`fact.payload->>'candidacy_id'`, "=", sql`candidacy.id::text`),
    )
    .select([
      "candidacy.id",
      "candidacy.given_name",
      "candidacy.family_name",
      "candidacy.elected",
      "race.election_code",
      sql<string | null>`coalesce(candidacy.person_id, fact.person_id)`.as(
        "person_id",
      ),
      "fact.match_reason",
    ])
    .where("race.municipality_code", "=", NITRA)
    .where("race.kind", "=", "municipal_council")
    .where("race.election_code", "in", ["OSO2018", "OSO2022", "OSO2026"])
    .execute();
  type Known = (typeof candidacies)[number] & { substitute: boolean };
  const known: Record<"OSO2018" | "OSO2022", Map<string, Known>> = {
    OSO2018: new Map(),
    OSO2022: new Map(),
  };
  for (const code of ["OSO2018", "OSO2022"] as const) {
    const map = known[code];
    const rank = (c: (typeof candidacies)[number]) =>
      (c.election_code === code ? 4 : 0) +
      (c.elected ? 2 : 0) +
      (c.person_id ? 1 : 0);
    for (const c of candidacies) {
      const key = normalise(`${c.given_name} ${c.family_name}`);
      const cur = map.get(key);
      if (!cur || rank(c) > rank(cur))
        map.set(key, { ...c, substitute: c.election_code !== code });
    }
  }
  const names = (code: "OSO2018" | "OSO2022") =>
    new Map([...known[code].keys()].map((k) => [k, k]));

  // --- PDFs.
  const media: { source_url: string }[] = [];
  for (let page = 1; ; page++) {
    const snap = await fetchSnapshot(
      "nitra_votes",
      `${MEDIA_API}?search=Hlasovania&per_page=100&page=${page}&_fields=id,source_url`,
    );
    const items = JSON.parse(snap.bytes.toString("utf-8")) as
      { source_url: string }[] | { code: string };
    if (!Array.isArray(items) || items.length === 0) break;
    media.push(...items);
    if (items.length < 100) break;
  }
  const urls = [
    ...new Set(
      media.map((m) => m.source_url).filter((u) => u.endsWith(".pdf")),
    ),
  ];
  const parsed: { session: ParsedSession; snapshot: Snapshot }[] = [];
  await mapPool(urls, 3, 100, async (url) => {
    const snapshot = await fetchSnapshot("nitra_votes", url);
    const session = parseVotes(await pdfText(snapshot.bytes, true));
    if (session && session.votes.length > 0) parsed.push({ session, snapshot });
  });

  // Seat window per member: first to last session in which they appear in any list. A member
  // counts as absent only inside their window, so resignations and substitutes are not
  // recorded as absences outside their time on the council.
  const windows = new Map<string, { from: string; to: string }>();
  for (const { session } of parsed) {
    const code = session.heldOn < TERM_2022_START ? "OSO2018" : "OSO2022";
    for (const v of session.votes) {
      for (const l of joinLists(v.lists)) {
        for (const n of listNames(l.text, names(code))) {
          if (!n.key) continue;
          const k = `${code}|${n.key}`;
          const w = windows.get(k);
          if (!w) windows.set(k, { from: session.heldOn, to: session.heldOn });
          else {
            if (session.heldOn < w.from) w.from = session.heldOn;
            if (session.heldOn > w.to) w.to = session.heldOn;
          }
        }
      }
    }
  }

  let votesStored = 0;
  let duplicateVotes = 0;
  let inconsistencies = 0;
  const unmatched = new Map<string, number>();

  await db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom("fact")
      .where("type", "in", ["council_vote", "attendance"])
      .where("source_id", "=", source)
      .execute();
    await trx.deleteFrom("session").where("body_id", "=", body.id).execute();
    await trx
      .deleteFrom("body_member")
      .where("term_id", "in", [terms.OSO2018, terms.OSO2022])
      .execute();

    const memberIds = new Map<string, string>();
    const memberFor = async (code: "OSO2018" | "OSO2022", key: string) => {
      const id = memberIds.get(`${code}|${key}`);
      if (id) return id;
      const c = known[code].get(key)!;
      const row = await trx
        .insertInto("body_member")
        .values({
          term_id: terms[code],
          given_name: c.given_name,
          family_name: c.family_name,
          normalised_name: key,
          person_id: c.person_id,
          candidacy_id: c.id,
          match_reason: jsonb({
            matched: ["name", "municipality"],
            seat: c.substitute ? "substitute_or_later_member" : "elected",
            candidacy_election: c.election_code,
            ...(c.match_reason ? { person_link: c.match_reason } : {}),
          }),
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      memberIds.set(`${code}|${key}`, row.id);
      return row.id;
    };

    for (const { session, snapshot } of parsed.sort((a, b) =>
      a.session.heldOn.localeCompare(b.session.heldOn),
    )) {
      const code = session.heldOn < TERM_2022_START ? "OSO2018" : "OSO2022";
      const s = await trx
        .insertInto("session")
        .values({
          body_id: body.id,
          term_id: terms[code],
          number: session.number,
          kind: session.kind,
          held_on: session.heldOn,
          slug: `mz-nitra-${session.heldOn}`,
          status: "collected",
          snapshot_id: snapshot.id,
        })
        .onConflict((oc) =>
          oc
            .columns(["body_id", "held_on"])
            .doUpdateSet({ number: session.number }),
        )
        .returning("id")
        .executeTakeFirstOrThrow();

      const items = new Map<string, string>();
      let position = (
        await trx
          .selectFrom("agenda_item")
          .select(sql<number>`coalesce(max(position), 0)`.as("p"))
          .where("session_id", "=", s.id)
          .executeTakeFirstOrThrow()
      ).p;
      for (const v of session.votes) {
        const material =
          v.description
            .match(/mat\.\s*č\.\s*(\d+\s*\/\s*\d{4})/i)?.[1]
            ?.replace(/\s/g, "") ?? null;
        const title =
          v.description.match(/[„"“,]{1,2}([^“”"]{6,}?)[“”"]/)?.[1]?.trim() ??
          v.description.slice(0, 300);
        const itemKey = material ?? `desc:${normalise(v.description)}`;
        let itemId = items.get(itemKey);
        if (!itemId) {
          const existing = material
            ? await trx
                .selectFrom("agenda_item")
                .select("id")
                .where("session_id", "=", s.id)
                .where("material_number", "=", material)
                .executeTakeFirst()
            : undefined;
          itemId =
            existing?.id ??
            (
              await trx
                .insertInto("agenda_item")
                .values({
                  session_id: s.id,
                  position: ++position,
                  material_number: material,
                  title,
                })
                .returning("id")
                .executeTakeFirstOrThrow()
            ).id;
          items.set(itemKey, itemId);
        }

        const kind = voteKind(v.description);
        const present = v.counts.pritomni ?? null;
        const needed = present !== null ? Math.floor(present / 2) + 1 : null;
        const narrow =
          needed !== null &&
          v.counts.za !== undefined &&
          Math.abs(v.counts.za - needed) <= 3;
        const isKey =
          kind === "resolution" && (KEY_TITLE.test(normalise(title)) || narrow);

        const casts: { key: string | null; name: string; choice: Choice }[] =
          [];
        for (const l of joinLists(v.lists)) {
          for (const n of listNames(l.text, names(code)))
            casts.push({ key: n.key, name: n.name, choice: l.choice });
        }
        const listed = (c: Choice) =>
          casts.filter((x) => x.choice === c).length;
        const inconsistent =
          (v.counts.za !== undefined && v.counts.za !== listed("for")) ||
          (v.counts.proti !== undefined &&
            v.counts.proti !== listed("against")) ||
          (v.counts["zdrzali sa"] !== undefined &&
            v.counts["zdrzali sa"] !== listed("abstain"));
        if (inconsistent) inconsistencies++;

        const inserted = await trx
          .insertInto("vote")
          .values({
            session_id: s.id,
            agenda_item_id: itemId,
            number: v.number,
            description: v.description,
            kind,
            count_for: v.counts.za ?? null,
            count_against: v.counts.proti ?? null,
            count_abstain: v.counts["zdrzali sa"] ?? null,
            count_not_voting: v.counts.nehlasovali ?? null,
            count_present: present,
            is_key: isKey,
            source_inconsistency: inconsistent,
            snapshot_id: snapshot.id,
          })
          .onConflict((oc) => oc.columns(["session_id", "number"]).doNothing())
          .returning("id")
          .executeTakeFirst();
        if (!inserted) {
          duplicateVotes++;
          continue;
        }
        votesStored++;

        // Members of the term not listed in any choice are absent for this vote.
        const listedKeys = new Set(casts.map((c) => c.key).filter(Boolean));
        for (const [k, w] of windows) {
          const [termCode, key] = k.split("|") as [string, string];
          if (termCode !== code || listedKeys.has(key)) continue;
          if (session.heldOn < w.from || session.heldOn > w.to) continue;
          const c = known[code].get(key)!;
          casts.push({
            key,
            name: `${c.given_name} ${c.family_name}`,
            choice: "absent",
          });
        }
        const rows = [];
        for (const c of casts) {
          if (!c.key) unmatched.set(c.name, (unmatched.get(c.name) ?? 0) + 1);
          rows.push({
            vote_id: inserted.id,
            body_member_id: c.key ? await memberFor(code, c.key) : null,
            name_as_written: c.name,
            choice: c.choice,
          });
        }
        if (rows.length)
          await trx.insertInto("vote_cast").values(rows).execute();
      }
    }

    // --- Facts for 2026 candidates: one per vote cast, plus attendance per term.
    await trx
      .insertInto("fact")
      .columns([
        "person_id",
        "type",
        "payload",
        "occurred_from",
        "source_id",
        "source_url",
        "snapshot_id",
        "method",
        "match_reason",
      ])
      .expression(
        (eb) =>
          eb
            .selectFrom("vote_cast")
            .innerJoin(
              "body_member",
              "body_member.id",
              "vote_cast.body_member_id",
            )
            .innerJoin("vote", "vote.id", "vote_cast.vote_id")
            .innerJoin("session", "session.id", "vote.session_id")
            .innerJoin(
              "source_snapshot",
              "source_snapshot.id",
              "vote.snapshot_id",
            )
            .where("body_member.person_id", "is not", null)
            .where("session.body_id", "=", body.id)
            .select([
              "body_member.person_id",
              sql<string>`'council_vote'`.as("type"),
              sql`jsonb_build_object('vote_id', vote.id, 'choice', vote_cast.choice, 'body', ${BODY_CODE}::text)`.as(
                "payload",
              ),
              "session.held_on",
              sql`${source}::uuid`.as("source_id"),
              "source_snapshot.url",
              "vote.snapshot_id",
              sql<string>`'register'`.as("method"),
              sql`jsonb_build_object('matched', jsonb_build_array('name', 'body_member', 'term'), 'body', 'Mestské zastupiteľstvo Nitra', 'via', body_member.match_reason)`.as(
                "match_reason",
              ),
            ]) as never,
      )
      .execute();

    await trx
      .insertInto("fact")
      .columns([
        "person_id",
        "type",
        "payload",
        "occurred_from",
        "occurred_to",
        "source_id",
        "source_url",
        "snapshot_id",
        "method",
        "match_reason",
      ])
      .expression(
        (eb) =>
          eb
            .selectFrom("vote_cast")
            .innerJoin(
              "body_member",
              "body_member.id",
              "vote_cast.body_member_id",
            )
            .innerJoin("term", "term.id", "body_member.term_id")
            .innerJoin("vote", "vote.id", "vote_cast.vote_id")
            .where("body_member.person_id", "is not", null)
            .where("term.body_id", "=", body.id)
            .groupBy([
              "body_member.person_id",
              "term.id",
              "term.starts_on",
              "term.ends_on",
            ])
            .select([
              "body_member.person_id",
              sql<string>`'attendance'`.as("type"),
              sql`jsonb_build_object('term_id', term.id, 'body', ${BODY_CODE}::text,
              'present_votes', count(*) filter (where vote_cast.choice <> 'absent'),
              'total_votes', count(*))`.as("payload"),
              "term.starts_on",
              "term.ends_on",
              sql`${source}::uuid`.as("source_id"),
              sql<string>`${MEDIA_API}::text`.as("source_url"),
              sql`(array_agg(vote.snapshot_id))[1]`.as("snapshot_id"),
              sql<string>`'register'`.as("method"),
              sql`jsonb_build_object('matched', jsonb_build_array('name', 'body_member', 'term'))`.as(
                "match_reason",
              ),
            ]) as never,
      )
      .execute();
  });

  const top = [...unmatched].sort((a, b) => b[1] - a[1]).slice(0, 8);
  return {
    pdfs: urls.length,
    sessions_parsed: parsed.length,
    votes: votesStored,
    duplicate_votes_skipped: duplicateVotes,
    source_inconsistencies: inconsistencies,
    unmatched_names: unmatched.size,
    unmatched_top: top.map(([n, c]) => `${n}×${c}`).join(", "),
  };
}
