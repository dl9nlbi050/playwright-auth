import type { APIRequestContext, Cookie } from "@playwright/test";

export interface StorageState {
  cookies: Cookie[];
  origins: { origin: string; localStorage: { name: string; value: string }[] }[];
}

export interface RoleConfig {
  role: string;
  email: string;
  password: string;
  /** Endpoint that starts a session; defaults to POST /api/session. */
  loginPath?: string;
}

const ENV_PREFIX = "AUTH_";

/**
 * Credentials are read from the environment so state files never contain
 * secrets and CI can inject per-PR accounts without touching the tests.
 */
export function roleFromEnv(role: string): RoleConfig {
  const key = `${ENV_PREFIX}${role.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
  const email = process.env[`${key}_EMAIL`];
  const password = process.env[`${key}_PASSWORD`];
  if (!email || !password) {
    throw new Error(`role "${role}" needs ${key}_EMAIL and ${key}_PASSWORD`);
  }
  return { role, email, password, loginPath: process.env[`${key}_LOGIN_PATH`] };
}

/**
 * Logs in once through the API and returns the resulting storage state.
 * Throwing here is intentional: a fixture that silently continues as an
 * anonymous user hides the regression the test was written to catch.
 */
export async function login(request: APIRequestContext, config: RoleConfig): Promise<StorageState> {
  const response = await request.post(config.loginPath ?? "/api/session", {
    data: { email: config.email, password: config.password },
  });
  if (!response.ok()) {
    const body = (await response.text()).slice(0, 200);
    throw new Error(`login for role "${config.role}" failed with ${response.status()}: ${body}`);
  }
  return request.storageState();
}
