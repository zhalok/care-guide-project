import { test } from '@playwright/test';
import { STEP_PAUSE_MS } from './constants';
import { showCursor } from './helpers';
import { buildSteps } from './steps';

test('admin (alice) and regular user (bob) journeys', async ({ page }) => {
  await showCursor(page);

  for (const step of buildSteps(page)) {
    await test.step(step.name, step.fn);
    await page.waitForTimeout(STEP_PAUSE_MS);
  }
});
