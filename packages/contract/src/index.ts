// Types shared between apps: API request and response shapes, domain entities.
// Keep this package free of runtime dependencies.

export interface Health {
  ok: boolean;
  database: boolean;
}

/** One result of GET /api/search. `meta` is already localised for display. */
export interface SearchHit {
  kind: "person" | "party" | "municipality" | "okres";
  slug: string;
  label: string;
  meta: string;
}

/** GET /api/search?q=&lang=&limit= — grouped results, at most `limit` per group. */
export interface SearchResponse {
  q: string;
  person: SearchHit[];
  party: SearchHit[];
  municipality: SearchHit[];
  okres: SearchHit[];
}
