import { db, jsonb } from "@repo/db";
import { csvRecords, xlsxRows, zipEntry } from "../lib/files";
import { normalise, text } from "../lib/names";
import { ELECTIONS, REGION_CODE, WAYBACK } from "../lib/region";
import type { Stats } from "../lib/run";
import { fetchSnapshot, type Snapshot } from "../lib/snapshot";
import { sourceId } from "../lib/sources";

type Kind = "mayor" | "municipal_council" | "regional_council";

interface Past {
  election: "OSO2022" | "OSO2018" | "VUC2022";
  kind: Kind;
  municipalityCode: string | null;
  district: number | null;
  ballot: number;
  given: string;
  family: string;
  /** Normalised "given family"; for 2018 rows with one name field, the whole field. */
  name: string;
  titles: string | null;
  age: number | null;
  occupation: string | null;
  party: string | null;
  elected: boolean | null;
  votes: number | null;
  snapshot: Snapshot;
}

/**
 * Past candidacies 2018–2022 for the Nitra region, linked to 2026 persons as `past_candidacy`
 * facts. Matching (specs/koho-volim, Identity Rules): name + municipality, plus age where the
 * source has it (2026 age minus elapsed years, ±1). Ambiguous matches link to every candidate
 * and say so in the match reason.
 */
export async function history(): Promise<Stats> {
  const municipalities = await db
    .selectFrom("municipality")
    .select(["code", "slug", "name"])
    .execute();
  const ours = new Set(municipalities.map((m) => m.code));
  const slugOf = new Map(municipalities.map((m) => [m.code, m.slug]));
  const nameOf = new Map(municipalities.map((m) => [m.code, m.name]));
  const rows: Past[] = [];

  // --- OSO 2022: all candidates, with age, occupation, party codes and results.
  const oso22 = await fetchSnapshot("statistics_results", WAYBACK.oso2022);
  const parties22 = new Map(
    csvRecords(zipEntry(oso22.bytes, "tab0c.csv"), "|").map((p) => [
      p.PS!,
      p.NPS!,
    ]),
  );
  const partyNames = (codes: string) =>
    codes
      .split(",")
      .map(
        (c) =>
          parties22.get(c.trim().padStart(3, "0")) ?? parties22.get(c.trim()),
      )
      .filter(Boolean)
      .join(", ") || null;
  const results = (
    table: string,
    key: (r: Record<string, string>) => string,
  ) => {
    const out = new Map<string, { votes: number; elected: boolean }>();
    for (const r of csvRecords(zipEntry(oso22.bytes, table), "|")) {
      if (!ours.has(r.OBEC!)) continue;
      const k = key(r);
      const cur = out.get(k) ?? { votes: 0, elected: false };
      cur.votes += Number(r.P_HL || 0);
      cur.elected ||= r.KANDIDAT === "1";
      out.set(k, cur);
    }
    return out;
  };
  const mayorResults = results("tab05f.csv", (r) => `${r.OBEC}|${r.PC_HL}`);
  const councilResults = results(
    "tab08f.csv",
    (r) => `${r.OBEC}|${r.VOOBEC}|${r.PC_HL}`,
  );

  for (const r of csvRecords(zipEntry(oso22.bytes, "tab0ad.csv"), "|")) {
    if (!ours.has(r.OBEC!)) continue;
    const res = mayorResults.get(`${r.OBEC}|${r.PC_HL}`);
    rows.push(past22(r, "mayor", null, res, oso22, partyNames(r.PS ?? "")));
  }
  for (const r of csvRecords(zipEntry(oso22.bytes, "tab0bd.csv"), "|")) {
    if (!ours.has(r.OBEC!)) continue;
    const res = councilResults.get(`${r.OBEC}|${r.VOOBEC}|${r.PC_HL}`);
    rows.push(
      past22(
        r,
        "municipal_council",
        Number(r.VOOBEC),
        res,
        oso22,
        partyNames(r.PS ?? ""),
      ),
    );
  }

  // --- OSO 2018: mayor candidates (elected flag from tab04) and elected councillors only.
  const oso18 = await fetchSnapshot("statistics_results", WAYBACK.oso2018);
  const sheet = async (name: string) =>
    (await xlsxRows(zipEntry(oso18.bytes, name))).slice(2);
  const electedMayors18 = new Set(
    (await sheet("tab04.xlsx"))
      .filter((r) => ours.has(String(r[6])))
      .map((r) => `${r[6]}|${normalise(`${r[8]} ${r[9]}`)}`),
  );
  for (const r of await sheet("tab0a.xlsx")) {
    if (!ours.has(String(r[6]))) continue;
    const name = normalise(`${r[9]} ${r[10]}`);
    rows.push({
      election: "OSO2018",
      kind: "mayor",
      municipalityCode: String(r[6]),
      district: null,
      ballot: Number(r[8]),
      given: text(r[9])!,
      family: text(r[10])!,
      name,
      titles: null,
      age: null,
      occupation: null,
      party: text(r[11]),
      elected: electedMayors18.has(`${r[6]}|${name}`),
      votes: null,
      snapshot: oso18,
    });
  }
  // tab06: separate name fields; tab06d: "Meno a priezvisko" in one field.
  for (const r of await sheet("tab06.xlsx")) {
    if (!ours.has(String(r[6]))) continue;
    rows.push(
      council18(
        String(r[6]),
        Number(r[8]),
        Number(r[9]),
        text(r[10])!,
        text(r[11])!,
        text(r[12]),
        Number(r[13]),
        oso18,
      ),
    );
  }
  for (const r of await sheet("tab06d.xlsx")) {
    if (!ours.has(String(r[6]))) continue;
    const full = text(r[10])!;
    const cut = full.lastIndexOf(" ");
    rows.push(
      council18(
        String(r[6]),
        Number(r[8]),
        Number(r[9]),
        full.slice(0, cut),
        full.slice(cut + 1),
        text(r[11]),
        Number(r[12]),
        oso18,
      ),
    );
  }

  // --- VÚC 2022: elected regional councillors (name, district, party).
  const osk22 = await fetchSnapshot(
    "statistics_results",
    WAYBACK.osk2022Elected,
  );
  for (const r of csvRecords(osk22.bytes, ";", "windows-1250", 2)) {
    if (r["Kód kraja"] !== REGION_CODE) continue;
    rows.push({
      election: "VUC2022",
      kind: "regional_council",
      municipalityCode: null,
      // District codes are region * 100 + number (401 = district 1 of region 4).
      district: Number(r["Kód volebného obvodu"]) % 100,
      ballot: Number(r["Poradie na hlasovacom lístku"]),
      given: r.Meno!,
      family: r.Priezvisko!,
      name: normalise(`${r.Meno} ${r.Priezvisko}`),
      titles: null,
      age: null,
      occupation: null,
      party: text(r["Politický subjekt"]),
      elected: true,
      votes: null,
      snapshot: osk22,
    });
  }

  // --- Index 2026 persons by name, with the municipalities they are tied to.
  const people = await db
    .selectFrom("person")
    .innerJoin("candidacy", "candidacy.person_id", "person.id")
    .innerJoin("race", "race.id", "candidacy.race_id")
    .select([
      "person.id",
      "person.normalised_name",
      "person.age_2026",
      "race.municipality_code",
      "candidacy.residence_municipality",
    ])
    .where("race.election_code", "in", ["OSO2026", "VUC2026"])
    .execute();
  const codeByName = new Map(
    municipalities.map((m) => [normalise(m.name), m.code]),
  );
  const byName = new Map<
    string,
    { id: string; age: number; places: Set<string> }
  >();
  for (const p of people) {
    const e = byName.get(p.id) ?? {
      id: p.id,
      age: p.age_2026,
      places: new Set<string>(),
    };
    if (p.municipality_code) e.places.add(p.municipality_code);
    const res = p.residence_municipality
      ? codeByName.get(normalise(p.residence_municipality))
      : null;
    if (res) e.places.add(res);
    byName.set(p.id, e);
  }
  const personsByName = new Map<
    string,
    { id: string; age: number; places: Set<string> }[]
  >();
  for (const p of people) {
    const list = personsByName.get(p.normalised_name) ?? [];
    if (!list.some((x) => x.id === p.id)) list.push(byName.get(p.id)!);
    personsByName.set(p.normalised_name, list);
  }

  const heldOn = new Map(ELECTIONS.map((e) => [e.code, e.held_on]));
  const source = await sourceId("statistics_results");
  let linked = 0;
  let ambiguous = 0;

  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom("fact").where("type", "=", "past_candidacy").execute();
    await trx
      .deleteFrom("candidacy")
      .where("race_id", "in", (q) =>
        q
          .selectFrom("race")
          .select("id")
          .where("election_code", "in", ["OSO2022", "OSO2018", "VUC2022"]),
      )
      .execute();

    const raceIds = new Map<string, string>();
    const raceFor = async (r: Past) => {
      const year = r.election.slice(-4);
      const muni = r.municipalityCode ? slugOf.get(r.municipalityCode) : null;
      const slug =
        r.kind === "mayor"
          ? `${year}-starosta-${muni}`
          : r.kind === "municipal_council"
            ? `${year}-zastupitelstvo-${muni}-obvod-${r.district}`
            : `${year}-zastupitelstvo-nsk-obvod-${r.district}`;
      const cached = raceIds.get(slug);
      if (cached) return cached;
      const race = await trx
        .insertInto("race")
        .values({
          election_code: r.election,
          kind: r.kind,
          municipality_code: r.municipalityCode,
          region_code: r.kind === "regional_council" ? REGION_CODE : null,
          slug,
        })
        .onConflict((oc) => oc.column("slug").doUpdateSet({ kind: r.kind }))
        .returning("id")
        .executeTakeFirstOrThrow();
      raceIds.set(slug, race.id);
      return race.id;
    };

    for (const r of rows) {
      const candidacy = await trx
        .insertInto("candidacy")
        .values({
          race_id: await raceFor(r),
          ballot_number: r.ballot,
          given_name: r.given,
          family_name: r.family,
          titles_before: r.titles,
          age: r.age,
          occupation: r.occupation,
          party_label: r.party,
          elected: r.elected,
          votes: r.votes,
          snapshot_id: r.snapshot.id,
        })
        .onConflict((oc) =>
          oc
            .columns(["race_id", "ballot_number", "given_name", "family_name"])
            .doNothing(),
        )
        .returning("id")
        .executeTakeFirst();
      if (!candidacy) continue;

      const year = Number(r.election.slice(-4));
      const namesakes = personsByName.get(r.name) ?? [];
      const matches = namesakes.filter((p) => {
        if (r.municipalityCode && !p.places.has(r.municipalityCode))
          return false;
        if (r.age !== null && Math.abs(p.age - (2026 - year) - r.age) > 1)
          return false;
        return true;
      });
      if (matches.length === 0) continue;
      if (matches.length > 1) ambiguous++;

      const matched = ["name"];
      if (r.municipalityCode) matched.push("municipality");
      if (r.age !== null) matched.push("age");
      const reason = {
        matched,
        unavailable: r.age === null ? ["age"] : [],
        namesakes: namesakes.length,
        ...(matches.length > 1 ? { ambiguous: matches.length } : {}),
      };
      for (const m of matches) {
        linked++;
        await trx
          .insertInto("fact")
          .values({
            person_id: m.id,
            type: "past_candidacy",
            payload: jsonb({
              candidacy_id: candidacy.id,
              election_code: r.election,
              race_kind: r.kind,
              municipality_code: r.municipalityCode,
              municipality_name: r.municipalityCode
                ? nameOf.get(r.municipalityCode)
                : null,
              district: r.district,
              party: r.party,
              occupation: r.occupation,
              age: r.age,
              elected: r.elected,
              votes: r.votes,
            }),
            occurred_from: heldOn.get(r.election)!,
            source_id: source,
            source_url: r.snapshot.url,
            snapshot_id: r.snapshot.id,
            method: "register",
            match_reason: jsonb(reason),
          })
          .execute();
      }
    }
  });

  const count = (e: Past["election"]) =>
    rows.filter((r) => r.election === e).length;
  return {
    oso2022_candidacies: count("OSO2022"),
    oso2018_candidacies: count("OSO2018"),
    vuc2022_elected: count("VUC2022"),
    facts_linked: linked,
    ambiguous_candidacies: ambiguous,
  };

  function past22(
    r: Record<string, string>,
    kind: Kind,
    district: number | null,
    res: { votes: number; elected: boolean } | undefined,
    snapshot: Snapshot,
    party: string | null,
  ): Past {
    return {
      election: "OSO2022",
      kind,
      municipalityCode: r.OBEC!,
      district,
      ballot: Number(r.PC_HL),
      given: r.MENO!,
      family: r.PRIEZVISKO!,
      name: normalise(`${r.MENO} ${r.PRIEZVISKO}`),
      titles: text(r.TITUL),
      age: Number(r.VEK) || null,
      occupation: text(r.ZAMESTNANIE),
      party,
      elected: res?.elected ?? null,
      votes: res?.votes ?? null,
      snapshot,
    };
  }

  function council18(
    code: string,
    district: number,
    ballot: number,
    given: string,
    family: string,
    party: string | null,
    votes: number,
    snapshot: Snapshot,
  ): Past {
    return {
      election: "OSO2018",
      kind: "municipal_council",
      municipalityCode: code,
      district,
      ballot,
      given,
      family,
      name: normalise(`${given} ${family}`),
      titles: null,
      age: null,
      occupation: null,
      party,
      elected: true,
      votes,
      snapshot,
    };
  }
}
