import { defineConfig } from '@playwright/test';

// End-to-end tests run against the whole stack, so start it first:
//   docker compose up -d && ./scripts/seed-docker.sh
// Then, from frontend/:
//   npx playwright install chromium     (once)
//   npm run e2e
// To use the Chrome that is already installed instead of downloading a browser:
//   PW_CHANNEL=chrome npm run e2e
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    // "chromium" = the Playwright Chromium in headless mode; "chrome" = your
    // installed Chrome.
    channel: process.env.PW_CHANNEL || 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
