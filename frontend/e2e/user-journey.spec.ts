import { expect, test, type Locator, type Page } from '@playwright/test';

// Needs the seeded demo data (./scripts/seed-docker.sh): alice (admin) and bob
// (user) with 10,000 notes each. The UI loads 20 notes per request.
const PAGE_SIZE = 20;
// How long the cursor dot takes to glide to its next target.
const CURSOR_GLIDE_MS = 700;
// Delay between typed characters.
const TYPING_DELAY_MS = 150;

const banner = (page: Page) => page.getByRole('banner');
const cards = (page: Page) => page.getByRole('main').getByRole('listitem');

/** Glide to a field, click it to focus, then type one character at a time. */
async function typeInto(field: Locator, text: string) {
  await glideAndClick(field);
  await field.pressSequentially(text, { delay: TYPING_DELAY_MS });
}

async function signIn(page: Page, email: string, password: string) {
  await typeInto(page.getByLabel('Email'), email);
  await typeInto(page.getByLabel('Password'), password);
  await glideAndClick(page.getByRole('button', { name: 'Sign in' }));
}

async function signOut(page: Page) {
  await glideAndClick(page.getByRole('button', { name: 'Log out' }));
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  // The session token must be gone, not just hidden.
  expect(
    await page.evaluate(() => sessionStorage.getItem('care-guide.token')),
  ).toBeNull();
}

const loadMoreButton = (page: Page) =>
  page.getByRole('button', { name: 'Load more' });

/** The first page of notes is shown; scroll down to the "Load more" button. */
async function scrollToLoadMore(page: Page, owner: 'Alice' | 'Bob') {
  await expect(cards(page)).toHaveCount(PAGE_SIZE);
  await expect(cards(page).first()).toContainText(`${owner}'s note #`);

  await loadMoreButton(page).scrollIntoViewIfNeeded();
}

/** Click "Load more" to append a second page, then scroll to the bottom of it. */
async function clickLoadMore(page: Page) {
  await glideAndClick(loadMoreButton(page));
  await expect(cards(page)).toHaveCount(PAGE_SIZE * 2);

  await page.evaluate(() =>
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }),
  );
}

/**
 * Playwright moves a synthetic mouse, so no real cursor shows in a headed run.
 * Draw a red dot that follows the mouse events so clicks are visible. The init
 * script re-runs on every page load.
 */
async function showCursor(page: Page) {
  await page.addInitScript((glideMs) => {
    window.addEventListener('DOMContentLoaded', () => {
      const dot = document.createElement('div');
      dot.style.cssText =
        'position:fixed;z-index:2147483647;pointer-events:none;width:20px;' +
        'height:20px;margin:-10px 0 0 -10px;border-radius:50%;' +
        'background:rgba(255,0,0,0.6);border:2px solid #fff;display:none;';
      let moved = false;
      document.body.appendChild(dot);
      document.addEventListener(
        'mousemove',
        (e) => {
          dot.style.display = 'block';
          dot.style.left = `${e.clientX}px`;
          dot.style.top = `${e.clientY}px`;
          if (!moved) {
            // First position: place the dot instantly, then animate later moves.
            moved = true;
            void dot.offsetWidth;
            dot.style.transition = `left ${glideMs}ms ease-in-out, top ${glideMs}ms ease-in-out`;
          }
        },
        true,
      );
    });
  }, CURSOR_GLIDE_MS);
}

/** Glide the cursor dot to the middle of an element, then click it. */
async function glideAndClick(locator: Locator) {
  await glideTo(locator);
  await locator.click();
}

/** Glide the cursor dot to the middle of an element and wait for it to arrive. */
async function glideTo(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (box) {
    await locator
      .page()
      .mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await locator.page().waitForTimeout(CURSOR_GLIDE_MS);
  }
}

type Step = {
  name: string;
  fn: () => Promise<void>;
};

test('admin (alice) and regular user (bob) journeys', async ({
  page,
}, testInfo) => {
  const shot = (name: string) =>
    page.screenshot({
      path: testInfo.outputPath(`${name}.png`),
      fullPage: true,
    });

  await showCursor(page);

  const steps: Step[] = [
    {
      name: 'alice logs in as admin',
      fn: async () => {
        await page.goto('/');
        await shot('01-login');
        await signIn(page, 'alice@example.com', 'alice123');

        await expect(banner(page)).toContainText('Alice');
        await expect(banner(page)).toContainText('admin');
        // An admin gets all three sections.
        for (const tab of ['My notes', 'All notes', 'Users']) {
          await expect(page.getByRole('button', { name: tab })).toBeVisible();
        }
      },
    },
    {
      name: 'alice scrolls to the load more button',
      fn: async () => {
        await scrollToLoadMore(page, 'Alice');
      },
    },
    {
      name: 'alice clicks load more',
      fn: async () => {
        await clickLoadMore(page);
        await shot('02-alice-notes');
      },
    },
    {
      name: 'alice opens the users page',
      fn: async () => {
        await glideAndClick(page.getByRole('button', { name: 'Users' }));

        await expect(
          cards(page).filter({ hasText: 'alice@example.com' }),
        ).toHaveCount(1);
        await expect(
          cards(page).filter({ hasText: 'bob@example.com' }),
        ).toHaveCount(1);
        await shot('03-alice-users');
      },
    },
    {
      name: 'alice logs out',
      fn: async () => {
        await signOut(page);
      },
    },
    {
      name: 'bob logs in as a regular user',
      fn: async () => {
        await signIn(page, 'bob@example.com', 'bob123');

        await expect(banner(page)).toContainText('Bob');
        await expect(banner(page)).toContainText('user');
        // A regular user only gets "My notes".
        await expect(
          page.getByRole('button', { name: 'My notes' }),
        ).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'All notes' }),
        ).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Users' })).toHaveCount(
          0,
        );
      },
    },
    {
      name: 'bob scrolls to the load more button',
      fn: async () => {
        await scrollToLoadMore(page, 'Bob');
      },
    },
    {
      name: 'bob clicks load more',
      fn: async () => {
        await clickLoadMore(page);
        await shot('04-bob-notes');
      },
    },
    {
      name: 'bob logs out',
      fn: async () => {
        await signOut(page);
        await shot('05-logged-out');
      },
    },
  ];

  for (const step of steps) {
    await test.step(step.name, step.fn);
  }
});
