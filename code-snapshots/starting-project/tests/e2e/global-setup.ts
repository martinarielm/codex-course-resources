import { execFileSync } from "node:child_process";

export default function globalSetup(): void {
  execFileSync(process.platform === "win32" ? "bun.exe" : "bun", ["scripts/migrate.ts", "up"], {
    env: {
      ...process.env,
      APP_URL: "http://localhost:3000",
      AUTH_SECRET: "tinynotes-e2e-only-secret-at-least-32-characters",
      DB_PATH: "./.test-data/tinynotes-e2e.db",
    },
    stdio: "inherit",
  });
}
