# playwright-auth

Playwright fixture that gives every test a deterministic, reusable authenticated
session. One API login per role per TTL window instead of a UI login in every
spec: suites start in a real session state, stay reproducible, and drop seconds
of navigation from the critical path.

The cache is keyed by `baseURL` + role, written atomically, checksummed against
truncated writes, and expires after `authTtlMs` (10 minutes by default) so a
stale cookie cannot outlive a deploy.

## Install

```sh
npm install
npx playwright install chromium
```

`@playwright/test` is a peer dependency; this package ships TypeScript sources
and no build step.

## Usage

```ts
// playwright.config.ts
export default defineConfig({
  use: { baseURL: "https://staging.example.test" },
});
```

```ts
// tests/billing.spec.ts
import { test, expect } from "playwright-auth";

test.use({ authRole: "member" });

test("invoice list is scoped to the member", async ({ page }) => {
  await page.goto("/invoices");
  await expect(page.getByRole("heading", { name: "Your invoices" })).toBeVisible();
});
```

The `storageState` fixture is overridden with the cached path, so Playwright
applies it to the context before the first navigation. Switching identity
mid-test uses the explicit login:

```ts
test("admin sees another tenant", async ({ authLogin }) => {
  const admin = await authLogin("admin");
  // hand admin.cookies to a second context
});
```

### Roles

A role is resolved from environment variables, uppercased with non-alphanumerics
folded to `_`:

| variable | meaning |
| --- | --- |
| `AUTH_<ROLE>_EMAIL` | account email, required |
| `AUTH_<ROLE>_PASSWORD` | account password, required |
| `AUTH_<ROLE>_LOGIN_PATH` | session endpoint, default `/api/session` |

`authLogin("admin")` therefore reads `AUTH_ADMIN_EMAIL` and `AUTH_ADMIN_PASSWORD`.

## Layout

```
src/auth.ts       role resolution and the API login
src/storage.ts    state path, TTL and atomic checksummed cache
src/fixtures.ts   test.extend wiring: authRole, authTtlMs, storageState, authLogin
src/index.ts      public exports
```

## Coverage and limits

Covered by the fixture contract: cache hit/miss, TTL expiry, digest mismatch on a
truncated file, atomic replacement under parallel workers.

Not covered: servers that bind a session to a fingerprint of the login request,
and flows with mandatory TOTP. Both need a per-role hook; keep them in the app
repo rather than forking this package.

## Quarantine policy

A test that fails on one run out of three on `main` goes to `test.fixme` with a
linked issue within one working day. It leaves quarantine only with three
consecutive green runs on `main`; otherwise it is deleted, not kept grey.

## License

MIT, see [LICENSE](LICENSE).
