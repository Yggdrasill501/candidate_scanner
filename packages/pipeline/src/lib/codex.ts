import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * One headless Codex call (`codex exec`) with structured JSON output, in an empty temporary
 * directory with a read-only sandbox, so only the prompt is in context. Uses the local Codex
 * (ChatGPT) login; no API key is involved. The schema must be strict (every object closed, every
 * property required).
 */
export async function codex<T>(
  system: string,
  prompt: string,
  schema: object,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "koho-codex-"));
  try {
    const schemaFile = join(dir, "schema.json");
    const outFile = join(dir, "out.json");
    await writeFile(schemaFile, JSON.stringify(schema));
    const args = [
      "exec",
      "--skip-git-repo-check",
      "--ephemeral",
      "--ignore-rules",
      "-s",
      "read-only",
      "-c",
      `model_reasoning_effort=${process.env.CODEX_EFFORT ?? "medium"}`,
      ...(process.env.CODEX_MODEL ? ["-m", process.env.CODEX_MODEL] : []),
      "--output-schema",
      schemaFile,
      "-o",
      outFile,
      "-",
    ];
    await new Promise<void>((resolve, reject) => {
      const child = spawn("codex", args, {
        cwd: dir,
        stdio: ["pipe", "ignore", "pipe"],
      });
      let err = "";
      child.stderr.on("data", (d) => (err = (err + d).slice(-2000)));
      child.on("error", reject);
      child.on("close", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`codex exited ${code}: ${err.slice(-500)}`)),
      );
      child.stdin.end(`${system}\n\n${prompt}`);
    });
    return JSON.parse(await readFile(outFile, "utf-8")) as T;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
