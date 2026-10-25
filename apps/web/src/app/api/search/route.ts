import type { NextRequest } from "next/server";
import type { SearchResponse } from "@repo/contract";
import { search } from "@/lib/data";
import { isLang, t } from "@/lib/i18n";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const requested = params.get("lang") ?? "";
  const lang = isLang(requested) ? requested : "sk";
  const limit = Math.min(10, Math.max(1, Number(params.get("limit")) || 10));
  const q = (params.get("q") ?? "").slice(0, 80);
  const d = t(lang);
  const r = await search(q, limit);
  const body: SearchResponse = {
    q,
    person: r.person.map((h) => ({
      kind: h.kind,
      slug: h.slug,
      label: h.label,
      meta: [h.raceKind && d.race.kindShort[h.raceKind], h.meta]
        .filter(Boolean)
        .join(" · "),
    })),
    party: r.party.map((h) => ({
      kind: h.kind,
      slug: h.slug,
      label: h.label,
      meta: d.race.candidates(Number(h.meta)),
    })),
    municipality: r.municipality.map(({ kind, slug, label, meta }) => ({
      kind,
      slug,
      label,
      meta,
    })),
    okres: r.okres.map(({ kind, slug, label, meta }) => ({
      kind,
      slug,
      label: d.search.okres(label),
      meta: d.search.okresMeta(Number(meta)),
    })),
  };
  return Response.json(body);
}
