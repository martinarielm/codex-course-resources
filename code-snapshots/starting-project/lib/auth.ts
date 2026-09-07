import "server-only";

import { betterAuth } from "better-auth/minimal";
import { bunSqliteAdapter } from "@/lib/auth-adapter";
import { getDatabase } from "@/lib/db";

if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  throw new Error("Set AUTH_SECRET to a random secret of at least 32 characters in .env.local.");
}

export const auth = betterAuth({
  appName: "TinyNotes",
  baseURL: process.env.APP_URL || "http://localhost:3000",
  secret: process.env.AUTH_SECRET,
  database: bunSqliteAdapter(getDatabase),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: false,
    autoSignIn: true,
  },
  advanced: {
    database: { generateId: "uuid" },
    disableCSRFCheck: false,
    disableOriginCheck: false,
  },
  disabledPaths: [
    "/request-password-reset",
    "/reset-password",
    "/send-verification-email",
    "/verify-email",
  ],
});
