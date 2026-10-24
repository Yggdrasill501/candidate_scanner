import { db, jsonb } from "@repo/db";
import { xlsxRows } from "../lib/files";
import { normalise, normalisedName, slugify, text } from "../lib/names";
import {
  MINV_FILES,
  REGION_CODE,
  REGION_NAME,
  splitTitles,
} from "../lib/region";
import type { Stats } from "../lib/run";
import { fetchSnapshot } from "../lib/snapshot";

type RaceKind =
  "mayor" | "municipal_council" | "regional_governor" | "regional_council";

interface Row {
  election: "OSO2026" | "VUC2026";
  kind: RaceKind;
  municipalityCode: string | null;
  district: number | null;
  ballot: number;
  given: string;
  family: string;
  titlesBefore: string | null;
  titlesAfter: string | null;
  age: number;
  occupation: string | null;
  party: string | null;
  residence: string | null;
  /** Municipality code that anchors identity: where they run, or where they live. */
  placeCode: string | null;
  snapshotId: string;
}

/**
 * Loads the 2026 MV SR candidate lists for the Nitra region and links candidacies to persons:
 * same normalised name + age + municipality (where they run, or residence for regional races).
 */
export async function candidates(): Promise<Stats> {
  const municipalities = await db
    .selectFrom("municipality")
    .selectAll()
    .execute();
  if (municipalities.length === 0)
    throw new Error("run the territory stage first");
  const byDistrictAndName = new Map(
    municipalities.map((m) => [
      `${normalise(m.district_name)}|${normalise(m.name)}`,
      m,
    ]),
  );
  const byName = new Map<string, typeof municipalities>();
  for (const m of municipalities) {
    const k = normalise(m.name);
    byName.set(k, [...(byName.get(k) ?? []), m]);
  }
  const districts = new Set(
    municipalities.map((m) => normalise(m.district_name)),
  );

  const rows: Row[] = [];
  const unmatched = new Set<string>();

  const municipalCode = (district: string, name: string) => {
    const m = byDistrictAndName.get(
      `${normalise(district)}|${normalise(name)}`,
    );
    if (!m) unmatched.add(`${district} / ${name}`);
    return m?.code ?? null;
  };
  const residenceCode = (name: string | null) => {
    if (!name) return null;
    const hits = byName.get(normalise(name)) ?? [];
    return hits.length === 1 ? hits[0]!.code : null;
  };

  // Municipal council: Okres, Obec, Obvod, Poradie, Meno, Priezvisko, Titul, Vek, Zamestnanie, Strana
  const council = await fetchSnapshot(
    "minv_candidates",
    MINV_FILES.councilMunicipal,
  );
  for (const r of (await xlsxRows(council.bytes)).slice(3)) {
    if (!districts.has(normalise(String(r[0] ?? "")))) continue;
    const code = municipalCode(String(r[0]), String(r[1]));
    const t = splitTitles(text(r[6]));
    rows.push({
      election: "OSO2026",
      kind: "municipal_council",
      municipalityCode: code,
      district: Number(r[2]),
      ballot: Number(r[3]),
      given: text(r[4])!,
      family: text(r[5])!,
      titlesBefore: t.before,
      titlesAfter: t.after,
      age: Number(r[7]),
      occupation: text(r[8]),
      party: text(r[9]),
      residence: null,
      placeCode: code,
      snapshotId: council.id,
    });
  }

  // Mayor: Okres, Obec, Poradie, Meno, Priezvisko, Titul, Vek, Zamestnanie, Strana
  const mayor = await fetchSnapshot("minv_candidates", MINV_FILES.mayor);
  for (const r of (await xlsxRows(mayor.bytes)).slice(3)) {
    if (!districts.has(normalise(String(r[0] ?? "")))) continue;
    const code = municipalCode(String(r[0]), String(r[1]));
    const t = splitTitles(text(r[5]));
    rows.push({
      election: "OSO2026",
      kind: "mayor",
      municipalityCode: code,
      district: null,
      ballot: Number(r[2]),
      given: text(r[3])!,
      family: text(r[4])!,
      titlesBefore: t.before,
      titlesAfter: t.after,
      age: Number(r[6]),
      occupation: text(r[7]),
      party: text(r[8]),
      residence: null,
      placeCode: code,
      snapshotId: mayor.id,
    });
  }

  // Regional council: Kraj, Obvod, Poradie, Meno, Priezvisko, Titul pred, Titul za, Vek, Zamestnanie, Obec TP, Strana
  const regional = await fetchSnapshot(
    "minv_candidates",
    MINV_FILES.councilRegional,
  );
  for (const r of (await xlsxRows(regional.bytes)).slice(3)) {
    if (text(r[0]) !== REGION_NAME) continue;
    rows.push({
      election: "VUC2026",
      kind: "regional_council",
      municipalityCode: null,
      district: Number(r[1]),
      ballot: Number(r[2]),
      given: text(r[3])!,
      family: text(r[4])!,
      titlesBefore: text(r[5]),
      titlesAfter: text(r[6]),
      age: Number(r[7]),
      occupation: text(r[8]),
      residence: text(r[9]),
      party: text(r[10]),
      placeCode: residenceCode(text(r[9])),
      snapshotId: regional.id,
    });
  }

  // Governor: Kraj, Poradie, Meno, Priezvisko, Titul pred, Titul za, Vek, Zamestnanie, Obec TP, Strana
  const governor = await fetchSnapshot("minv_candidates", MINV_FILES.governor);
  for (const r of (await xlsxRows(governor.bytes)).slice(3)) {
    if (text(r[0]) !== REGION_NAME) continue;
    rows.push({
      election: "VUC2026",
      kind: "regional_governor",
      municipalityCode: null,
      district: null,
      ballot: Number(r[1]),
      given: text(r[2])!,
      family: text(r[3])!,
      titlesBefore: text(r[4]),
      titlesAfter: text(r[5]),
      age: Number(r[6]),
      occupation: text(r[7]),
      residence: text(r[8]),
      party: text(r[9]),
      placeCode: residenceCode(text(r[8])),
      snapshotId: governor.id,
    });
  }

  if (unmatched.size > 0) {
    throw new Error(
      `municipalities not found in territory table: ${[...unmatched].join("; ")}`,
    );
  }

  // Identity: rows sharing name + age + place are one person.
  const slugOfMunicipality = new Map(
    municipalities.map((m) => [m.code, m.slug]),
  );
  const identity = (r: Row) =>
    `${normalisedName(r.given, r.family)}|${r.age}|${r.placeCode ?? `?${normalise(r.residence ?? "")}`}`;
  const groups = new Map<string, Row[]>();
  for (const r of rows)
    groups.set(identity(r), [...(groups.get(identity(r)) ?? []), r]);

  const baseSlug = (r: Row) =>
    `${slugify(`${r.given} ${r.family}`)}-${
      r.placeCode
        ? slugOfMunicipality.get(r.placeCode)
        : slugify(r.residence ?? "nsk")
    }`;
  const slugCount = new Map<string, number>();
  for (const g of groups.values()) {
    const s = baseSlug(g[0]!);
    slugCount.set(s, (slugCount.get(s) ?? 0) + 1);
  }

  await db.transaction().execute(async (trx) => {
    // Candidacies for 2026 are reloaded in full; persons are kept stable by slug.
    await trx
      .deleteFrom("candidacy")
      .where("race_id", "in", (q) =>
        q
          .selectFrom("race")
          .select("id")
          .where("election_code", "in", ["OSO2026", "VUC2026"]),
      )
      .execute();

    const raceIds = new Map<string, string>();
    const raceFor = async (r: Row): Promise<string> => {
      const muni = r.municipalityCode
        ? slugOfMunicipality.get(r.municipalityCode)
        : null;
      const slug =
        r.kind === "mayor"
          ? `2026-starosta-${muni}`
          : r.kind === "municipal_council"
            ? `2026-zastupitelstvo-${muni}-obvod-${r.district}`
            : r.kind === "regional_governor"
              ? "2026-predseda-nsk"
              : `2026-zastupitelstvo-nsk-obvod-${r.district}`;
      const cached = raceIds.get(slug);
      if (cached) return cached;

      let districtId: string | null = null;
      if (r.district !== null) {
        const scope = r.kind === "municipal_council" ? "municipal" : "regional";
        const existing = await trx
          .selectFrom("electoral_district")
          .select("id")
          .where("election_code", "=", r.election)
          .where("scope", "=", scope)
          .where("number", "=", r.district)
          .where((eb) =>
            scope === "municipal"
              ? eb("municipality_code", "=", r.municipalityCode)
              : eb("region_code", "=", REGION_CODE),
          )
          .executeTakeFirst();
        districtId =
          existing?.id ??
          (
            await trx
              .insertInto("electoral_district")
              .values({
                election_code: r.election,
                scope,
                municipality_code:
                  scope === "municipal" ? r.municipalityCode : null,
                region_code: scope === "regional" ? REGION_CODE : null,
                number: r.district,
              })
              .returning("id")
              .executeTakeFirstOrThrow()
          ).id;
      }
      const race = await trx
        .insertInto("race")
        .values({
          election_code: r.election,
          kind: r.kind,
          municipality_code: r.municipalityCode,
          region_code: r.election === "VUC2026" ? REGION_CODE : null,
          electoral_district_id: districtId,
          slug,
        })
        .onConflict((oc) =>
          oc.column("slug").doUpdateSet({ electoral_district_id: districtId }),
        )
        .returning("id")
        .executeTakeFirstOrThrow();
      raceIds.set(slug, race.id);
      return race.id;
    };

    for (const group of groups.values()) {
      const first = group[0]!;
      let slug = baseSlug(first);
      if ((slugCount.get(slug) ?? 0) > 1) slug = `${slug}-${first.age}`;
      const person = await trx
        .insertInto("person")
        .values({
          given_name: first.given,
          family_name: first.family,
          normalised_name: normalisedName(first.given, first.family),
          slug,
          age_2026: first.age,
        })
        .onConflict((oc) =>
          oc.column("slug").doUpdateSet({
            given_name: first.given,
            family_name: first.family,
            normalised_name: normalisedName(first.given, first.family),
            age_2026: first.age,
          }),
        )
        .returning("id")
        .executeTakeFirstOrThrow();

      const matched =
        group.length > 1
          ? {
              matched: ["name", "age", "municipality"],
              rule: "same person within 2026 lists",
            }
          : { matched: ["source_record"] };
      for (const r of group) {
        await trx
          .insertInto("candidacy")
          .values({
            person_id: person.id,
            race_id: await raceFor(r),
            ballot_number: r.ballot,
            given_name: r.given,
            family_name: r.family,
            titles_before: r.titlesBefore,
            titles_after: r.titlesAfter,
            age: r.age,
            occupation: r.occupation,
            party_label: r.party,
            residence_municipality: r.residence,
            snapshot_id: r.snapshotId,
            match_reason: jsonb(matched),
          })
          .execute();
      }
    }

    await trx
      .deleteFrom("person")
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom("candidacy")
              .select("id")
              .whereRef("candidacy.person_id", "=", "person.id"),
          ),
        ),
      )
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom("fact")
              .select("id")
              .whereRef("fact.person_id", "=", "person.id"),
          ),
        ),
      )
      .execute();
  });

  const count = (k: RaceKind) => rows.filter((r) => r.kind === k).length;
  return {
    candidacies: rows.length,
    persons: groups.size,
    municipal_council: count("municipal_council"),
    mayor: count("mayor"),
    regional_council: count("regional_council"),
    regional_governor: count("regional_governor"),
    regional_residence_unresolved: rows.filter(
      (r) => r.election === "VUC2026" && !r.placeCode,
    ).length,
  };
}
