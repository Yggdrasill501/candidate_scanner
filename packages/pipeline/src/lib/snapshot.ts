import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { relative } from "node:path";
import { join } from "node:path";
import { db } from "@repo/db";
import { DATA_DIR } from "./env";
import { type SourceCode, sourceId } from "./sources";

export interface Snapshot {
  id: string;
  url: string;
  bytes: Buffer;
}

const USER_AGENT = "KohoVolim/0.1 (neutral candidate profiles)";

/** Wikimedia asks automated clients for a contact; it is sent to Wikimedia and nowhere else. */
function userAgent(code: SourceCode): string {
  const contact = process.env.WIKIMEDIA_CONTACT;
  return code === "wikipedia" && contact
    ? `${USER_AGENT.replace(/\)$/, "")}; ${contact})`
    : USER_AGENT;
}

/**
 * Stores bytes content-addressed under data/snapshots and records them in source_snapshot.
 * Snapshots are immutable: the same content is stored once and reused.
 */
export async function storeSnapshot(
  code: SourceCode,
  url: string,
  bytes: Buffer,
  httpStatus: number,
  contentType: string | null,
): Promise<Snapshot> {
  const source = await sourceId(code);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const storageKey = join("snapshots", sha256.slice(0, 2), sha256);
  const path = join(DATA_DIR, storageKey);
  if (!existsSync(path)) {
    await mkdir(join(DATA_DIR, "snapshots", sha256.slice(0, 2)), {
      recursive: true,
    });
    await writeFile(path, bytes);
  }
  const inserted = await db
    .insertInto("source_snapshot")
    .values({
      source_id: source,
      url,
      sha256,
      content_type: contentType,
      storage_key: storageKey,
      http_status: httpStatus,
    })
    .onConflict((oc) => oc.columns(["url", "sha256"]).doNothing())
    .returning("id")
    .executeTakeFirst();
  const id =
    inserted?.id ??
    (
      await db
        .selectFrom("source_snapshot")
        .select("id")
        .where("url", "=", url)
        .where("sha256", "=", sha256)
        .executeTakeFirstOrThrow()
    ).id;
  return { id, url, bytes };
}

/**
 * Fetches a URL and stores it as a snapshot. Retries with backoff; on 429 it waits for the
 * server's Retry-After (or a minute) before trying again.
 */
export async function fetchSnapshot(
  code: SourceCode,
  url: string,
): Promise<Snapshot> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": userAgent(code) },
      });
      if (res.status === 429) {
        const wait = Number(res.headers.get("retry-after")) || 60;
        await new Promise((r) => setTimeout(r, wait * 1000));
        throw new Error(`HTTP 429 for ${url}`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      return await storeSnapshot(
        code,
        url,
        bytes,
        res.status,
        res.headers.get("content-type"),
      );
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw lastError;
}

/** Reads a stored snapshot back from disk. */
export async function readSnapshot(storageKey: string): Promise<Buffer> {
  return readFile(join(DATA_DIR, storageKey));
}

/**
 * Records a large file already under data/ (e.g. a database dump) as a snapshot without copying
 * it into the content-addressed store.
 */
export async function registerLocalFile(
  code: SourceCode,
  url: string,
  path: string,
  contentType: string,
): Promise<Snapshot & { sha256: string }> {
  const source = await sourceId(code);
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path))
    hash.update(chunk as Buffer);
  const sha256 = hash.digest("hex");
  const storageKey = relative(DATA_DIR, path);
  await db
    .insertInto("source_snapshot")
    .values({
      source_id: source,
      url,
      sha256,
      content_type: contentType,
      storage_key: storageKey,
      http_status: 200,
    })
    .onConflict((oc) => oc.columns(["url", "sha256"]).doNothing())
    .execute();
  const row = await db
    .selectFrom("source_snapshot")
    .select("id")
    .where("url", "=", url)
    .where("sha256", "=", sha256)
    .executeTakeFirstOrThrow();
  return { id: row.id, url, bytes: Buffer.alloc(0), sha256 };
}
