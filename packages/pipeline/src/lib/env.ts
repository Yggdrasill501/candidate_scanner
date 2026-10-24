import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// One .env at the repository root, as for the web app and kysely-ctl.
const rootEnv = fileURLToPath(new URL("../../../../.env", import.meta.url));
if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

/** Root folder for raw source snapshots (gitignored). */
export const DATA_DIR = fileURLToPath(
  new URL("../../../../data/", import.meta.url),
);
