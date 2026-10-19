import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

/**
 * E2E tests run against a production build and a local Supabase stack (`npm run db:start`).
 * Without ANTHROPIC_API_KEY the AI tests use tests/e2e/mock-anthropic.mjs, which speaks the
 * Messages API streaming protocol. With a real key the same tests hit the real API.
 */
const PORT = Number(process.env.E2E_PORT ?? 3000);
const realAi = Boolean(process.env.ANTHROPIC_API_KEY);
const MOCK_PORT = 4010;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "sv-SE",
    timezoneId: "Europe/Stockholm",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testMatch: /(auth|diary)\.spec\.ts/ },
  ],
  webServer: [
    ...(realAi
      ? []
      : [
          {
            command: `node tests/e2e/mock-anthropic.mjs`,
            url: `http://127.0.0.1:${MOCK_PORT}/health`,
            reuseExistingServer: !process.env.CI,
            env: { MOCK_ANTHROPIC_PORT: String(MOCK_PORT) },
          },
        ]),
    {
      command: `npx next build && npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
      env: {
        NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
        ...(realAi ? {} : { ANTHROPIC_API_KEY: "mock-key", ANTHROPIC_BASE_URL: `http://127.0.0.1:${MOCK_PORT}` }),
        AI_GENERATION_HOURLY_LIMIT: "50",
      },
    },
  ],
});
