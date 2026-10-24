import "./lib/env";
import { db } from "@repo/db";
import { type Stats, withRun } from "./lib/run";
import { candidates } from "./stages/candidates";
import { demagog } from "./stages/demagog";
import { history } from "./stages/history";
import { media } from "./stages/media";
import { nitraVotes } from "./stages/nitra-votes";
import { nskDeclarations } from "./stages/nsk-declarations";
import { rmno } from "./stages/rmno";
import { rpo } from "./stages/rpo";
import { rpvs } from "./stages/rpvs";
import { summaries } from "./stages/summaries";
import { territory } from "./stages/territory";
import { tis } from "./stages/tis";
import { topics } from "./stages/topics";
import { wikipedia } from "./stages/wikipedia";

const STAGES = {
  territory,
  candidates,
  history,
  rpvs,
  rpo,
  "nsk-declarations": nskDeclarations,
  rmno,
  "nitra-votes": nitraVotes,
  media,
  wikipedia,
  demagog,
  tis,
  topics,
  summaries,
} as const;

/**
 * Stages listed above run by default, in order. Any other stage is loaded from
 * src/stages/<name>.ts, which must export `run(): Promise<Stats>`.
 */
async function load(name: string): Promise<(runId: string) => Promise<Stats>> {
  const known = STAGES[name as keyof typeof STAGES];
  if (known) return known;
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`invalid stage name "${name}"`);
  const mod = (await import(`./stages/${name}.ts`)) as { run?: () => Promise<Stats> };
  if (!mod.run) throw new Error(`stage file stages/${name}.ts has no exported run()`);
  return mod.run;
}

async function main() {
  const requested = process.argv.slice(2);
  const names = requested.length > 0 ? requested : Object.keys(STAGES);
  for (const name of names) {
    await withRun(name, await load(name));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
