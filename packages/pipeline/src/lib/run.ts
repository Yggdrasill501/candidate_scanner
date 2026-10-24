import { db, jsonb } from "@repo/db";

export type Stats = Record<string, number | string>;

/** Records a pipeline_run around a stage. A failed stage leaves published data untouched. */
export async function withRun(
  stage: string,
  fn: (runId: string) => Promise<Stats>,
): Promise<void> {
  const run = await db
    .insertInto("pipeline_run")
    .values({ stage })
    .returning("id")
    .executeTakeFirstOrThrow();
  try {
    const stats = await fn(run.id);
    await db
      .updateTable("pipeline_run")
      .set({
        status: "succeeded",
        finished_at: new Date(),
        stats: jsonb(stats),
      })
      .where("id", "=", run.id)
      .execute();
    console.log(`[${stage}] succeeded`, stats);
  } catch (error) {
    await db
      .updateTable("pipeline_run")
      .set({
        status: "failed",
        finished_at: new Date(),
        stats: jsonb({ error: String(error) }),
      })
      .where("id", "=", run.id)
      .execute();
    throw error;
  }
}
