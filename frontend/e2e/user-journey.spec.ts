import { expect, test, type Page } from '@playwright/test';

// Needs the seeded demo data (./scripts/seed-docker.sh): alice (admin) and bob
// (user) with 10,000 notes each. The UI loads 20 notes per request.
const PAGE_SIZE = 20;

const banner = (page: Page) => page.getByRole('banner');
const cards = (page: Page) => page.getByRole('main').getByRole('listitem');

async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  // The session token must be gone, not just hidden.
  expect(
    await page.evaluate(() => sessionStorage.getItem('care-guide.token')),
  ).toBeNull();
}

/** First page of notes, then "Load more" appends a second page. */
async function loadNotesThenMore(page: Page, owner: 'Alice' | 'Bob') {
  await expect(cards(page)).toHaveCount(PAGE_SIZE);
  await expect(cards(page).first()).toContainText(`${owner}'s note #`);

  await page.getByRole('button', { name: 'Load more' }).click();

  await expect(cards(page)).toHaveCount(PAGE_SIZE * 2);
}

test('admin (alice) and regular user (bob) journeys', async ({ page }, testInfo) => {
  const shot = (name: string) =>
    page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });

  await test.step('alice logs in as admin', async () => {
    await page.goto('/');
    await shot('01-login');
    await signIn(page, 'alice@example.com', 'alice123');

    await expect(banner(page)).toContainText('Alice');
    await expect(banner(page)).toContainText('admin');
    // An admin gets all three sections.
    for (const tab of ['My notes', 'All notes', 'Users']) {
      await expect(page.getByRole('button', { name: tab })).toBeVisible();
    }
  });

  await test.step('alice loads her notes, then loads more', async () => {
    await loadNotesThenMore(page, 'Alice');
    await shot('02-alice-notes');
  });

  await test.step('alice opens the users page', async () => {
    await page.getByRole('button', { name: 'Users' }).click();

    await expect(cards(page).filter({ hasText: 'alice@example.com' })).toHaveCount(1);
    await expect(cards(page).filter({ hasText: 'bob@example.com' })).toHaveCount(1);
    await shot('03-alice-users');
  });

  await test.step('alice logs out', async () => {
    await signOut(page);
  });

  await test.step('bob logs in as a regular user', async () => {
    await signIn(page, 'bob@example.com', 'bob123');

    await expect(banner(page)).toContainText('Bob');
    await expect(banner(page)).toContainText('user');
    // A regular user only gets "My notes".
    await expect(page.getByRole('button', { name: 'My notes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'All notes' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Users' })).toHaveCount(0);
  });

  await test.step("bob checks his notes, then loads more", async () => {
    await loadNotesThenMore(page, 'Bob');
    await shot('04-bob-notes');
  });

  await test.step('bob logs out', async () => {
    await signOut(page);
    await shot('05-logged-out');
  });
});
