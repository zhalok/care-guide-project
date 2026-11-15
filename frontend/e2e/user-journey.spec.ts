import { test } from '@playwright/test';
import { showCursor } from './helpers';
import { buildSteps } from './steps';

test('admin (alice) and regular user (bob) journeys', async ({ page }) => {
  await showCursor(page);

  for (const step of buildSteps(page)) {
    await test.step(step.name, step.fn);
  }
});
