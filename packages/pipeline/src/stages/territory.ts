import { db } from "@repo/db";
import { csvRecords, zipEntry } from "../lib/files";
import { slugify } from "../lib/names";
import { ELECTIONS, REGION_CODE, WAYBACK } from "../lib/region";
import type { Stats } from "../lib/run";
import { fetchSnapshot } from "../lib/snapshot";

/** Elections and Nitra-region municipalities with official codes (ŠÚ SR 2022 territory table). */
export async function territory(): Promise<Stats> {
  for (const e of ELECTIONS) {
    await db
      .insertInto("election")
      .values(e)
      .onConflict((oc) =>
        oc.column("code").doUpdateSet({ kind: e.kind, held_on: e.held_on }),
      )
      .execute();
  }

  const zip = await fetchSnapshot("statistics_results", WAYBACK.oso2022);
  const rows = csvRecords(zipEntry(zip.bytes, "tab0dd.csv"), "|").filter(
    (r) => r.KRAJ === REGION_CODE,
  );
  if (rows.length === 0)
    throw new Error("no Nitra-region municipalities in tab0dd");

  for (const r of rows) {
    const base = slugify(r.NOBEC!);
    // Same village name can exist in two districts; disambiguate with the district.
    const dup = rows.filter((o) => slugify(o.NOBEC!) === base).length > 1;
    const slug = dup ? `${base}-${slugify(r.NOKRES!)}` : base;
    await db
      .insertInto("municipality")
      .values({
        code: r.OBEC!,
        name: r.NOBEC!,
        slug,
        district_name: r.NOKRES!,
        district_code: r.OKRES!,
        region_code: REGION_CODE,
      })
      .onConflict((oc) =>
        oc.column("code").doUpdateSet({
          name: r.NOBEC!,
          slug,
          district_name: r.NOKRES!,
          district_code: r.OKRES!,
        }),
      )
      .execute();
  }
  const districts = new Set(rows.map((r) => r.NOKRES));
  return { municipalities: rows.length, districts: districts.size };
}
