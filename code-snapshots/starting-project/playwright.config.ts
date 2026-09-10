import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "bun --bun next dev",
    env: {
      APP_URL: baseURL,
      AUTH_SECRET: "tinynotes-e2e-only-secret-at-least-32-characters",
      DB_PATH: "./.test-data/tinynotes-e2e.db",
    },
    reuseExistingServer: !process.env.CI,
    url: baseURL,
  },
});
