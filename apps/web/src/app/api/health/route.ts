import type { Health } from "@repo/contract";
import { db, sql } from "@repo/db";

export async function GET() {
  let database = false;
  try {
    await sql`select 1`.execute(db);
    database = true;
  } catch {
    // Reported in the body; the app itself is up.
  }
  const body: Health = { ok: true, database };
  return Response.json(body, { status: database ? 200 : 503 });
}
