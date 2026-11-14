import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { StorageState } from "./auth.js";

/** Cached sessions older than this are discarded before reuse. */
export const DEFAULT_TTL_MS = 10 * 60 * 1000;
export const DEFAULT_STATE_DIR = join(tmpdir(), "playwright-auth");

interface Envelope {
  /** Epoch milliseconds, written next to the state so TTL checks never stat mtimes. */
  createdAt: number;
  /** SHA-256 of the serialized state, used to detect truncated writes. */
  digest: string;
  state: StorageState;
}

export function statePath(baseURL: string, role: string, dir = DEFAULT_STATE_DIR): string {
  const fingerprint = createHash("sha256").update(`${baseURL}\n${role}`).digest("hex").slice(0, 12);
  return join(dir, `${role}-${fingerprint}.json`);
}

function digestOf(state: StorageState): string {
  return createHash("sha256").update(JSON.stringify(state)).digest("hex");
}

/**
 * Returns a cached state for the exact baseURL/role pair, or null when the
 * file is missing, expired, unparsable, or fails its digest check.
 */
export async function readState(
  path: string,
  ttlMs = DEFAULT_TTL_MS,
  now = Date.now(),
): Promise<StorageState | null> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }

  let envelope: Envelope;
  try {
    envelope = JSON.parse(raw) as Envelope;
  } catch {
    return null;
  }
  if (typeof envelope.createdAt !== "number") return null;
  if (now - envelope.createdAt > ttlMs) return null;
  if (envelope.digest !== digestOf(envelope.state)) return null;
  return envelope.state;
}

/** Writes atomically so parallel workers never read a half-written envelope. */
export async function writeState(path: string, state: StorageState, now = Date.now()): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const envelope: Envelope = { createdAt: now, digest: digestOf(state), state };
  const temp = `${path}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(envelope), "utf8");
  await rename(temp, path);
}
