/** Statistical Office code of Nitriansky kraj, used as region_code. */
export const REGION_CODE = "4";
export const REGION_NAME = "Nitriansky samosprávny kraj";

export const ELECTIONS = [
  { code: "OSO2026", kind: "municipal", held_on: "2026-10-24" },
  { code: "VUC2026", kind: "regional", held_on: "2026-10-24" },
  { code: "OSO2022", kind: "municipal", held_on: "2022-10-29" },
  { code: "VUC2022", kind: "regional", held_on: "2022-10-29" },
  { code: "OSO2018", kind: "municipal", held_on: "2018-11-10" },
  { code: "VUC2017", kind: "regional", held_on: "2017-11-04" },
] as const;

/** Archived Statistical Office files (volby.statistics.sk itself no longer serves them). */
export const WAYBACK = {
  oso2022:
    "https://web.archive.org/web/2024id_/https://volby.statistics.sk/oso/oso2022/files/OSO2022_SK_csv.zip",
  oso2018:
    "https://web.archive.org/web/2023id_/https://volby.statistics.sk/oso/oso2018/files/OSO_2018_xlsx.zip",
  osk2022Elected:
    "https://web.archive.org/web/2025id_/https://volby.statistics.sk/opendata/osk/2022/OSK2022_SK_tab04a.csv",
};

export const MINV_FILES = {
  councilMunicipal:
    "https://www.minv.sk/swift_data/source/verejna_sprava/volby_a_referendum/150_oso/OSO26_ZZK-Poslanci.xlsx",
  mayor:
    "https://www.minv.sk/swift_data/source/verejna_sprava/volby_a_referendum/150_oso/OSO26_ZZK-Starosta.xlsx",
  councilRegional:
    "https://www.minv.sk/swift_data/source/verejna_sprava/volby_a_referendum/140_vuc/VUC26_ZZK-Poslanci.xlsx",
  governor:
    "https://www.minv.sk/swift_data/source/verejna_sprava/volby_a_referendum/140_vuc/VUC26_ZZK-Predseda.xlsx",
};

const POST_NOMINALS =
  /^(PhD\.?|CSc\.?|DrSc\.?|ArtD\.?|MBA|MPH|DBA|BSc\.?|MSc\.?|MA|LL\.?M\.?|DiS\.?|DiS\.art\.?|MPA|MHA|Ph\.D\.)$/i;

/** Splits a combined title string ("Ing., PhD.") into pre- and post-nominals. */
export function splitTitles(titles: string | null): {
  before: string | null;
  after: string | null;
} {
  if (!titles) return { before: null, after: null };
  const parts = titles
    .split(/,\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  const before: string[] = [];
  const after: string[] = [];
  for (const part of parts) {
    const words = part.split(/\s+/);
    if (words.every((w) => POST_NOMINALS.test(w))) after.push(part);
    else before.push(part);
  }
  return { before: before.join(" ") || null, after: after.join(", ") || null };
}
