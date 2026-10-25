// Same normalisation as packages/pipeline/src/lib/names.ts, so search input matches
// person.normalised_name and generated slugs.

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

/** Party labels on coalition lists name every member party, separated by ", " or "; ". */
export function partyParts(label: string): string[] {
  return label
    .split(/[,;]\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

const INDEPENDENT = /^nez[aá]visl[ýá] kandid[aá]t(ka)?$/i;

export function isIndependent(label: string | null): boolean {
  return !label || INDEPENDENT.test(label.trim());
}
