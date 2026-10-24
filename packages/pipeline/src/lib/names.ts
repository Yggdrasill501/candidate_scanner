/** Lowercase, strip diacritics, collapse whitespace. "Ján  Horváth" -> "jan horvath". */
export function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function slugify(text: string): string {
  return normalise(text).replace(/ /g, "-");
}

export function normalisedName(given: string, family: string): string {
  return normalise(`${given} ${family}`);
}

/** Cell value from a spreadsheet or CSV as trimmed text, or null when empty. */
export function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
}

/** Strips academic titles: "Ing. Roman Ágh, MBA" -> "Roman Ágh". */
export function stripTitles(name: string): string {
  return name
    .split(",")[0]!
    .split(/\s+/)
    .filter(
      (w) =>
        w !== "" &&
        !w.endsWith(".") &&
        !/^(MBA|MPH|BSc|MSc|PhD|LL\.M|DBA|MA)$/i.test(w),
    )
    .join(" ");
}
