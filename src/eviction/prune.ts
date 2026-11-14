import { readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_STATE_DIR } from "../storage.js";

export interface PruneResult {
  removed: number;
  kept: number;
}

/** Cached states older than this are leftovers from earlier runs, not sessions. */
export const DEFAULT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/**
 * Lists the cache directory and deletes state envelopes whose mtime is older
 * than maxAgeMs. Only `*.json` files are touched, so the `<pid>.tmp` files of
 * a concurrent writer survive. A missing directory is not an error: the first
 * run of a fresh worker has nothing to prune.
 */
export async function pruneStateDir(
  dir = DEFAULT_STATE_DIR,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
  now = Date.now(),
): Promise<PruneResult> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { removed: 0, kept: 0 };
    throw error;
  }

  const result: PruneResult = { removed: 0, kept: 0 };
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const path = join(dir, name);
    const info = await stat(path);
    if (now - info.mtimeMs <= maxAgeMs) {
      result.kept += 1;
      continue;
    }
    await unlink(path);
    result.removed += 1;
  }
  return result;
}
