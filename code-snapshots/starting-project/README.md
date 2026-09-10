# TinyNotes

Next.js App Router, TypeScript, Bun, and SQLite. Email/password authentication uses
Better Auth with a custom raw-SQL adapter for the existing migration schema.

## Local setup

1. Run `bun install`.
2. Copy `.env.example` to `.env.local`.
3. Generate a secret with `bun -e 'console.log(require("node:crypto").randomBytes(32).toString("base64url"))'`
   and put it in `AUTH_SECRET` in `.env.local`.
4. Run `bun run migrate` to apply the existing SQL migrations.
5. Run `bun dev` and open [localhost:3000](http://localhost:3000).

Keep `.env.local` and `data/` private; both are ignored by Git. `DB_PATH` defaults to
`./data/tinynotes.db`. Relative paths are resolved from this project directory.
Set `APP_URL` to the actual application origin (including its port). Production
requires an HTTPS origin and its own random `AUTH_SECRET`.

Use Bun for development, builds, and serving: `bun run build`, then `bun start`.
The Next.js scripts explicitly select Bun because Node cannot load `bun:sqlite`.
Do not run Better Auth's schema generator; `scripts/migrate.ts` owns migrations.

## Authentication

- Register with a name, email, and password of 8–128 characters. Registration also logs you in.
- Login uses email/password; logout revokes the session in SQLite.
- Sessions use HttpOnly, SameSite cookies (Secure over HTTPS). Passwords are hashed by Better Auth.
- `/` redirects to `/login` or `/notes` based on the database session. Logged-in users visiting the auth pages go to `/notes`.
- The `/notes` landing page is protected. Future note reads/actions must call `requireSession()` themselves and check ownership; a layout check alone is insufficient.
- Note editing is a later lesson. Password reset, email verification, and email delivery are not enabled.

The adapter uses bound SQL parameters, ISO text timestamps, integer booleans, and
queued SQLite transactions so concurrent auth requests cannot share an open
transaction. Server Components read sessions without refreshing cookies; the
Better Auth `/api/auth/get-session` endpoint can refresh sessions when called by a client.

## Verification

```sh
bun run lint
bun run test:unit
bun run test:auth
bun run build
bun run test:e2e
```

Vitest runs component unit tests from `tests/unit/`. Playwright runs browser tests from
`tests/e2e/`, starts the Next.js development server automatically, and uses an isolated
SQLite database under `.test-data/`. Install Chromium once with
`bunx playwright install chromium` if it is not already available locally.

Auth tests use a separate in-memory database created from `0001_init.sql`; they do
not touch local users or notes. They cover password hashing, cookies, failed login,
expiry/revocation, CSRF, duplicate registration, and transaction rollback.

Browser check: register, reload `/notes`, log out, try an incorrect password, then
log back in. Opening `/notes` while logged out should redirect to `/login`.

References: [Better Auth Next.js integration](https://www.better-auth.com/docs/integrations/next),
[custom adapter guide](https://www.better-auth.com/docs/guides/create-a-db-adapter).
