import { test as base, expect } from "@playwright/test";
import { login, roleFromEnv, type StorageState } from "./auth.js";
import { DEFAULT_TTL_MS, readState, statePath, writeState } from "./storage.js";

export interface AuthFixtures {
  /** Session to log in as. Set per file with test.use({ authRole: "admin" }). */
  authRole: string;
  authTtlMs: number;
  authStateDir: string | undefined;
  /** Overrides the built-in storageState fixture with a cached state path. */
  storageState: string;
  /** Explicit login for role switches inside a single test. */
  authLogin: (role?: string) => Promise<StorageState>;
}

/**
 * test.use({ authRole }) swaps the persona; storageState is then produced from
 * the cache or the API and passed to the browser context by Playwright itself.
 */
export const test = base.extend<AuthFixtures>({
  authRole: ["member", { option: true }],
  authTtlMs: [DEFAULT_TTL_MS, { option: true }],
  authStateDir: [undefined, { option: true }],

  storageState: async ({ authRole, authTtlMs, authStateDir, baseURL, request }, use) => {
    if (!baseURL) throw new Error("the auth fixture needs a baseURL in the Playwright config");
    const path = statePath(baseURL, authRole, authStateDir);

    if (await readState(path, authTtlMs)) {
      await use(path);
      return;
    }

    await writeState(path, await login(request, roleFromEnv(authRole)));
    await use(path);
  },

  authLogin: async ({ authTtlMs, authStateDir, baseURL, request }, use) => {
    if (!baseURL) throw new Error("authLogin needs a baseURL in the Playwright config");
    await use(async (role = "member") => {
      const path = statePath(baseURL, role, authStateDir);
      const cached = await readState(path, authTtlMs);
      if (cached) return cached;
      const state = await login(request, roleFromEnv(role));
      await writeState(path, state);
      return state;
    });
  },
});

export { expect };
