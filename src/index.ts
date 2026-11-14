/**
 * Public surface. Import from the package root in specs:
 *
 *   import { test, expect } from "playwright-auth";
 */
export { login, roleFromEnv, type RoleConfig, type StorageState } from "./auth.js";
export { test, expect, type AuthFixtures } from "./fixtures.js";
export { DEFAULT_STATE_DIR, DEFAULT_TTL_MS, readState, statePath, writeState } from "./storage.js";
