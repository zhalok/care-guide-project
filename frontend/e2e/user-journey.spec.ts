import { test } from '@playwright/test';
import { showCursor } from './helpers';
import { buildSteps } from './steps';

test('admin (alice) and regular user (bob) journeys', async ({
  page,
}, testInfo) => {
  const shot = (name: string) =>
    page.screenshot({
      path: testInfo.outputPath(`${name}.png`),
      fullPage: true,
    });

  await showCursor(page);

  for (const step of buildSteps(page, shot)) {
    await test.step(step.name, step.fn);
  }
});
