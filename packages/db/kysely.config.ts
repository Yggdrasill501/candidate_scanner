import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "kysely-ctl";
import { db } from "./src/index";

const rootEnv = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

export default defineConfig({
  kysely: db,
  migrations: {
    migrationFolder: "migrations",
    // 20261023143000_ — sorts by name, which is the order Kysely applies them in.
    getMigrationPrefix: () =>
      `${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}_`,
  },
});
