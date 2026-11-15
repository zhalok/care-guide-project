import { defineConfig } from '@playwright/test';

// End-to-end tests run against the whole stack, so start it first:
//   docker compose up -d && ./scripts/seed-docker.sh
// Then, from frontend/:
//   npx playwright install chromium     (once)
//   npm run e2e
// To use the Chrome that is already installed instead of downloading a browser:
//   PW_CHANNEL=chrome npm run e2e
// Slow motion: Playwright waits this many ms after every browser action (click,
// fill, scroll, ...) so a person can follow a headed run. SLOWMO=0 for full speed.
const slowMo = Number(process.env.SLOWMO ?? 1000);

export default defineConfig({
  testDir: './e2e',
  // Every action is delayed by slowMo, so allow plenty of time.
  timeout: 5 * 60_000,
  // expect: { timeout: 10_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    // "chromium" = the Playwright Chromium in headless mode; "chrome" = your
    // installed Chrome.
    channel: process.env.PW_CHANNEL || 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: false,
    launchOptions: { slowMo },
  },
});
