import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Text layer of a PDF via poppler's pdftotext (must be installed). */
export async function pdfText(bytes: Buffer, layout = false): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "kv-pdf-"));
  try {
    const file = join(dir, "in.pdf");
    await writeFile(file, bytes);
    const args = ["-enc", "UTF-8", ...(layout ? ["-layout"] : []), file, "-"];
    const { stdout } = await run("pdftotext", args, {
      maxBuffer: 64 * 1024 * 1024,
    });
    return stdout;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
