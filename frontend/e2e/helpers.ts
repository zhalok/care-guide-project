import { expect, type Locator, type Page } from '@playwright/test';
import { CURSOR_GLIDE_MS, PAGE_SIZE, TYPING_DELAY_MS } from './constants';

export const banner = (page: Page) => page.getByRole('banner');
export const cards = (page: Page) =>
  page.getByRole('main').getByRole('listitem');

/** Glide to a field, click it to focus, then type one character at a time. */
async function typeInto(field: Locator, text: string) {
  await glideAndClick(field);
  await field.pressSequentially(text, { delay: TYPING_DELAY_MS });
}

export async function signIn(page: Page, email: string, password: string) {
  await typeInto(page.getByLabel('Email'), email);
  await typeInto(page.getByLabel('Password'), password);
  await glideAndClick(page.getByRole('button', { name: 'Sign in' }));
}

export async function signOut(page: Page) {
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
export async function scrollToLoadMore(page: Page, owner: 'Alice' | 'Bob') {
  await expect(cards(page)).toHaveCount(PAGE_SIZE);
  await expect(cards(page).first()).toContainText(`${owner}'s note #`);

  await smoothScrollTo(loadMoreButton(page));
}

/** Smooth-scroll an element to the middle of the viewport and wait until the scroll stops. */
async function smoothScrollTo(locator: Locator) {
  await locator.evaluate((el) =>
    el.scrollIntoView({ behavior: 'smooth', block: 'center' }),
  );
  // Smooth scrolling has no "done" event: wait until scrollY holds still.
  await locator.page().evaluate(
    () =>
      new Promise<void>((resolve) => {
        let last = window.scrollY;
        let stillFrames = 0;
        const tick = () => {
          stillFrames = window.scrollY === last ? stillFrames + 1 : 0;
          last = window.scrollY;
          if (stillFrames >= 10) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
}

/** Smooth-scroll back to the top of the page. */
export async function scrollToTop(page: Page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForFunction(() => window.scrollY === 0);
}

/** Click "Load more" to append a second page, then scroll to the bottom of it. */
export async function clickLoadMore(page: Page) {
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
export async function showCursor(page: Page) {
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
export async function glideAndClick(locator: Locator) {
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
