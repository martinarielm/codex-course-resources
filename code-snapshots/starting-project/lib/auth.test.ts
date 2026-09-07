import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// Set these before importing the real server configuration. Never use local data.
process.env.DB_PATH = ":memory:";
process.env.AUTH_SECRET = crypto.randomUUID() + crypto.randomUUID();
process.env.APP_URL = "http://localhost:3000";

const { auth } = await import("./auth");
const { getDatabase } = await import("./db");
const db = getDatabase();
const migration = readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8");
db.exec(migration.split("--! UP")[1].split("--! DOWN")[0]);

const credentials = { name: "Test User", email: "test@example.com", password: "test-password-123" };

function request(path: string, body?: object, cookie?: string, origin = "http://localhost:3000") {
  return auth.handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        origin,
        ...(body ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  );
}

async function register() {
  const response = await request("/sign-up/email", credentials);
  expect(response.status).toBe(200);
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  expect(cookie).toContain("session_token=");
  return { response, cookie };
}

beforeEach(() => {
  db.exec("DROP TRIGGER IF EXISTS reject_account; DELETE FROM user; DELETE FROM verification;");
});

afterAll(() => db.close());

describe("email/password authentication with the existing SQL schema", () => {
  test("registers, hashes the password, stores ISO dates/booleans and persists a cookie session", async () => {
    const { response, cookie } = await register();
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=Lax");
    const account = db
      .query<{ password: string; providerId: string }, []>(
        "SELECT password, providerId FROM account",
      )
      .get()!;
    expect(account.password).not.toBe(credentials.password);
    expect(account.providerId).toBe("credential");
    const user = db
      .query<{ id: string; createdAt: string; emailVerified: number }, []>(
        "SELECT id, createdAt, emailVerified FROM user",
      )
      .get()!;
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(user.createdAt).toISOString()).toBe(user.createdAt);
    expect(user.emailVerified).toBe(0);
    const session = await (await request("/get-session", undefined, cookie)).json();
    expect(session.user.email).toBe(credentials.email);
    expect(session.user.emailVerified).toBe(false);
    expect(session.user.password).toBeUndefined();
  });

  test("logs out, rejects the old cookie, then logs in with a normalized email", async () => {
    const { cookie } = await register();
    expect((await request("/sign-out", {}, cookie)).status).toBe(200);
    expect(await (await request("/get-session", undefined, cookie)).json()).toBeNull();
    expect(db.query("SELECT id FROM session").all()).toHaveLength(0);
    const login = await request("/sign-in/email", {
      email: "TEST@example.com",
      password: credentials.password,
    });
    expect(login.status).toBe(200);
    expect(login.headers.get("set-cookie")).toContain("session_token=");
  });

  test("returns the same generic error for unknown users and wrong passwords", async () => {
    await register();
    const wrongPassword = await request("/sign-in/email", {
      email: credentials.email,
      password: "wrong-password",
    });
    const unknownUser = await request("/sign-in/email", {
      email: "missing@example.com",
      password: "wrong-password",
    });
    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(await wrongPassword.json()).toEqual(await unknownUser.json());
  });

  test("rejects expired, absent, and forged sessions", async () => {
    const { cookie } = await register();
    db.query("UPDATE session SET expiresAt = ?").run(new Date(0).toISOString());
    expect(await (await request("/get-session", undefined, cookie)).json()).toBeNull();
    expect(await (await request("/get-session")).json()).toBeNull();
    expect(
      await (await request("/get-session", undefined, "better-auth.session_token=forged")).json(),
    ).toBeNull();
  });

  test("rejects invalid registration input and SQL-like credentials", async () => {
    for (const overrides of [
      { password: "short" },
      { password: "x".repeat(129) },
      { email: "not-an-email" },
    ]) {
      expect(
        (await request("/sign-up/email", { ...credentials, ...overrides })).status,
      ).toBeGreaterThanOrEqual(400);
    }
    const injection = await request("/sign-in/email", {
      email: "' OR 1=1 --@example.com",
      password: credentials.password,
    });
    expect(injection.status).toBeGreaterThanOrEqual(400);
    expect(db.query("SELECT id FROM user").all()).toHaveLength(0);
  });

  test("allows only one concurrent registration for an email", async () => {
    const responses = await Promise.all([
      request("/sign-up/email", credentials),
      request("/sign-up/email", credentials),
    ]);
    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(responses.filter((response) => response.status >= 400)).toHaveLength(1);
    for (const table of ["user", "account", "session"]) {
      expect(db.query(`SELECT id FROM ${table}`).all()).toHaveLength(1);
    }
  });

  test("rolls back user creation if saving the credential account fails", async () => {
    db.exec(
      "CREATE TRIGGER reject_account BEFORE INSERT ON account BEGIN SELECT RAISE(ABORT, 'simulated account failure'); END;",
    );
    const response = await request("/sign-up/email", credentials);
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await response.text()).not.toContain("simulated account failure");
    expect(db.query("SELECT id FROM user").all()).toHaveLength(0);
    expect(db.query("SELECT id FROM account").all()).toHaveLength(0);
    expect(db.query("SELECT id FROM session").all()).toHaveLength(0);
    db.exec("DROP TRIGGER reject_account;");
    await register();
  });

  test("blocks requests from an untrusted origin", async () => {
    const response = await request(
      "/sign-up/email",
      credentials,
      undefined,
      "https://untrusted.example",
    );
    expect(response.status).toBe(403);
    expect(db.query("SELECT id FROM user").all()).toHaveLength(0);
  });

  test("does not expose password reset or email verification endpoints", async () => {
    for (const path of [
      "/request-password-reset",
      "/reset-password",
      "/send-verification-email",
      "/verify-email",
    ]) {
      expect((await request(path, {})).status).toBe(404);
    }
  });
});
