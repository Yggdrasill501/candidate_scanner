// Types shared between apps: API request and response shapes, domain entities.
// Keep this package free of runtime dependencies.

export interface Health {
  ok: boolean;
  database: boolean;
}
