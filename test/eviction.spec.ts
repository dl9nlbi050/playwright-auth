import { mkdtemp, readdir, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { DEFAULT_MAX_AGE_MS, pruneStateDir } from "../src/eviction/prune.js";

test("removes expired envelopes and keeps fresh ones", async () => {
  const dir = await mkdtemp(join(tmpdir(), "auth-prune-"));
  const stale = join(dir, "member-old.json");
  const fresh = join(dir, "member-new.json");
  const inFlight = join(dir, "member-new.json.4242.tmp");
  await writeFile(stale, "{}");
  await writeFile(fresh, "{}");
  await writeFile(inFlight, "{}");

  const old = new Date(Date.now() - DEFAULT_MAX_AGE_MS - 60_000);
  await utimes(stale, old, old);
  await utimes(inFlight, old, old);

  expect(await pruneStateDir(dir)).toEqual({ removed: 1, kept: 1 });
  expect((await readdir(dir)).sort()).toEqual(["member-new.json", "member-new.json.4242.tmp"]);
});

test("a missing cache directory prunes nothing and does not throw", async () => {
  const dir = join(tmpdir(), "auth-prune-missing", String(process.pid));
  expect(await pruneStateDir(dir)).toEqual({ removed: 0, kept: 0 });
});
