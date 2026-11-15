import { expect, type Page } from '@playwright/test';
import {
  banner,
  cards,
  clickLoadMore,
  glideAndClick,
  scrollToLoadMore,
  scrollToTop,
  signIn,
  signOut,
} from './helpers';

export type Step = {
  name: string;
  fn: () => Promise<void>;
};

/** The journey, in order. */
export function buildSteps(page: Page): Step[] {
  return [
    {
      name: 'alice logs in as admin',
      fn: async () => {
        await page.goto('/');
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
      },
    },
    {
      name: 'alice scrolls back to the top',
      fn: async () => {
        await scrollToTop(page);
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
      },
    },
    {
      name: 'bob scrolls back to the top',
      fn: async () => {
        await scrollToTop(page);
      },
    },
    {
      name: 'bob logs out',
      fn: async () => {
        await signOut(page);
      },
    },
  ];
}
