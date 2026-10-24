import { spawn } from "node:child_process";

export interface ClaudeResult<T> {
  output: T;
  costUsd: number;
}

/**
 * One headless Claude Code call (`claude -p`) with structured JSON output. Runs without tools,
 * project settings or MCP servers, with a short system prompt, so only the task is in context.
 * Uses the local Claude Code login; no API key is involved.
 */
export async function claude<T>(
  system: string,
  prompt: string,
  schema: object,
  model = process.env.CLAUDE_MODEL ?? "sonnet",
): Promise<ClaudeResult<T>> {
  const args = [
    "-p",
    "--no-session-persistence",
    "--tools",
    "",
    "--setting-sources",
    "",
    "--strict-mcp-config",
    "--disable-slash-commands",
    "--model",
    model,
    "--system-prompt",
    system,
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(schema),
  ];
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const stdout = await new Promise<string>((resolve, reject) => {
        const child = spawn("claude", args, { stdio: ["pipe", "pipe", "pipe"] });
        let out = "";
        let err = "";
        child.stdout.on("data", (d) => (out += d));
        child.stderr.on("data", (d) => (err += d));
        child.on("error", reject);
        child.on("close", (code) =>
          code === 0 ? resolve(out) : reject(new Error(`claude exited ${code}: ${err.slice(0, 500)}`)),
        );
        child.stdin.end(prompt);
      });
      const result = JSON.parse(stdout) as {
        is_error: boolean;
        structured_output?: T;
        total_cost_usd?: number;
        result?: string;
      };
      if (result.is_error || !result.structured_output) {
        throw new Error(`claude returned no structured output: ${result.result?.slice(0, 300)}`);
      }
      return { output: result.structured_output, costUsd: result.total_cost_usd ?? 0 };
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
  throw lastError;
}
