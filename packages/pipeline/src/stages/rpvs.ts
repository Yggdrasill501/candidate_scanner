import { db, jsonb } from "@repo/db";
import { normalise, normalisedName } from "../lib/names";
import { mapPool } from "../lib/pool";
import type { Stats } from "../lib/run";
import { fetchSnapshot } from "../lib/snapshot";
import { sourceId } from "../lib/sources";

const API = "https://rpvs.gov.sk/opendatav2";
const ELECTION_DAY = new Date("2026-10-24");

interface RpvsPerson {
  Meno: string | null;
  Priezvisko: string | null;
  DatumNarodenia: string | null;
  JeVerejnyCinitel?: boolean;
  ObchodneMeno: string | null;
  Ico: string | null;
  FormaOsoby?: string;
  PlatnostOd: string | null;
  PlatnostDo: string | null;
  Adresa?: { Mesto: string | null; MestoKod: string | null } | null;
  Partner?: { Id: number } | null;
}

interface PartnerOrg {
  name: string | null;
  ico: string | null;
}

/** Whole years between birth and election day. */
function ageOn(birth: string): number {
  const b = new Date(birth);
  let age = ELECTION_DAY.getFullYear() - b.getFullYear();
  const m = ELECTION_DAY.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && ELECTION_DAY.getDate() < b.getDate())) age--;
  return age;
}

/**
 * Company roles from RPVS: beneficial owner (konečný užívateľ výhod) and public-sector partner
 * as a natural person (sole trader). One query per candidate surname; a record links to a
 * candidate when the full name matches and, where RPVS gives a birth date, the age matches
 * (±1). The birth date and address are used for matching only and are not stored.
 */
export async function rpvs(): Promise<Stats> {
  const source = await sourceId("rpvs");
  const people = await db
    .selectFrom("person")
    .leftJoin("candidacy", "candidacy.person_id", "person.id")
    .leftJoin("race", "race.id", "candidacy.race_id")
    .select([
      "person.id",
      "person.family_name",
      "person.normalised_name",
      "person.age_2026",
      "race.municipality_code",
      "candidacy.residence_municipality",
    ])
    .where("race.election_code", "in", ["OSO2026", "VUC2026"])
    .execute();
  const municipalities = await db
    .selectFrom("municipality")
    .select(["code", "name"])
    .execute();
  const codeByName = new Map(
    municipalities.map((m) => [normalise(m.name), m.code]),
  );

  const byName = new Map<
    string,
    Map<string, { id: string; age: number; places: Set<string> }>
  >();
  for (const p of people) {
    const group = byName.get(p.normalised_name) ?? new Map();
    const e = group.get(p.id) ?? {
      id: p.id,
      age: p.age_2026,
      places: new Set<string>(),
    };
    if (p.municipality_code) e.places.add(p.municipality_code);
    const res = p.residence_municipality
      ? codeByName.get(normalise(p.residence_municipality))
      : null;
    if (res) e.places.add(res);
    group.set(p.id, e);
    byName.set(p.normalised_name, group);
  }
  const surnames = [...new Set(people.map((p) => p.family_name))];

  const partners = new Map<number, Promise<PartnerOrg>>();
  const partnerOrg = (id: number) => {
    let p = partners.get(id);
    if (!p) {
      p = (async () => {
        const snap = await fetchSnapshot(
          "rpvs",
          `${API}/Partneri(${id})?$expand=PartneriVerejnehoSektora`,
        );
        const data = JSON.parse(snap.bytes.toString("utf-8")) as {
          PartneriVerejnehoSektora: RpvsPerson[];
        };
        const current =
          data.PartneriVerejnehoSektora.find((x) => !x.PlatnostDo) ??
          data.PartneriVerejnehoSektora.at(-1);
        return {
          name:
            current?.ObchodneMeno ??
            ([current?.Meno, current?.Priezvisko].filter(Boolean).join(" ") ||
              null),
          ico: current?.Ico || null,
        };
      })();
      partners.set(id, p);
    }
    return p;
  };

  type Hit = {
    record: RpvsPerson;
    role: "kuv" | "partner";
    snapshot: { id: string; url: string };
  };
  const hits: Hit[] = [];
  let failed = 0;
  await mapPool(surnames, 4, 50, async (surname) => {
    const q = encodeURIComponent(
      `Priezvisko eq '${surname.replace(/'/g, "''")}'`,
    );
    for (const [role, set, expand] of [
      ["kuv", "KonecniUzivateliaVyhod", "Adresa,Partner"],
      ["partner", "PartneriVerejnehoSektora", "Adresa,Partner"],
    ] as const) {
      try {
        const snap = await fetchSnapshot(
          "rpvs",
          `${API}/${set}?$filter=${q}&$expand=${expand}`,
        );
        const data = JSON.parse(snap.bytes.toString("utf-8")) as {
          value: RpvsPerson[];
        };
        for (const record of data.value) {
          if (!record.Meno || !record.Priezvisko) continue;
          if (!byName.has(normalisedName(record.Meno, record.Priezvisko)))
            continue;
          hits.push({ record, role, snapshot: snap });
        }
      } catch {
        failed++;
      }
    }
  });

  let linked = 0;
  let rejectedByAge = 0;
  const facts: Parameters<typeof insertFacts>[0] = [];
  for (const { record, role, snapshot } of hits) {
    const candidates = [
      ...byName.get(normalisedName(record.Meno!, record.Priezvisko!))!.values(),
    ];
    const age = record.DatumNarodenia ? ageOn(record.DatumNarodenia) : null;
    const place = record.Adresa?.MestoKod?.slice(-6) ?? null;
    const matches = candidates.filter(
      (c) => age === null || Math.abs(c.age - age) <= 1,
    );
    rejectedByAge += candidates.length - matches.length;
    if (matches.length === 0 || !record.Partner) continue;
    const org = await partnerOrg(record.Partner.Id);
    for (const m of matches) {
      const matched = ["name"];
      const mismatched: string[] = [];
      if (age !== null) matched.push("age");
      if (place && m.places.has(place)) matched.push("municipality");
      else if (place) mismatched.push("municipality");
      linked++;
      facts.push({
        person_id: m.id,
        payload: {
          role: role === "kuv" ? "beneficial_owner" : "public_sector_partner",
          organisation: org.name,
          ico: org.ico,
          rpvs_partner_id: record.Partner.Id,
          public_official: record.JeVerejnyCinitel ?? null,
          address_municipality: record.Adresa?.Mesto ?? null,
        },
        occurred_from: record.PlatnostOd?.slice(0, 10) ?? null,
        occurred_to: record.PlatnostDo?.slice(0, 10) ?? null,
        source_url: snapshot.url,
        snapshot_id: snapshot.id,
        match_reason: {
          matched,
          mismatched,
          unavailable: age === null ? ["age"] : [],
          namesakes: candidates.length,
          ...(matches.length > 1 ? { ambiguous: matches.length } : {}),
        },
      });
    }
  }

  // RPVS repeats a record when the partner has several versions; keep one per role and period.
  const seen = new Set<string>();
  const unique = facts.filter((f) => {
    const key = `${f.person_id}|${f.payload.rpvs_partner_id}|${f.payload.role}|${f.occurred_from}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  facts.length = 0;
  facts.push(...unique);

  await insertFacts(facts);
  return {
    surnames: surnames.length,
    name_hits: hits.length,
    facts_linked: linked,
    rejected_by_age: rejectedByAge,
    persons_with_roles: new Set(facts.map((f) => f.person_id)).size,
    failed_queries: failed,
  };

  async function insertFacts(
    rows: {
      person_id: string;
      payload: Record<string, unknown>;
      occurred_from: string | null;
      occurred_to: string | null;
      source_url: string;
      snapshot_id: string;
      match_reason: Record<string, unknown>;
    }[],
  ) {
    await db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom("fact")
        .where("type", "=", "business_role")
        .where("source_id", "=", source)
        .execute();
      for (const r of rows) {
        await trx
          .insertInto("fact")
          .values({
            person_id: r.person_id,
            type: "business_role",
            payload: jsonb(r.payload),
            occurred_from: r.occurred_from,
            occurred_to: r.occurred_to,
            source_id: source,
            source_url: r.source_url,
            snapshot_id: r.snapshot_id,
            method: "register",
            match_reason: jsonb(r.match_reason),
          })
          .execute();
      }
    });
  }
}
