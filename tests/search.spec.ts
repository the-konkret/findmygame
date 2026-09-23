import { test, expect } from '@playwright/test';
import { step } from './support/step';

test.describe('Search', () => {
  test('finds a game and lists the best-known one first', async ({ page }) => {
    await step(page, 'Open the home page', async () => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Find your next game' })).toBeVisible();
      await expect(page.getByTestId('search-input')).toBeFocused();
    });

    await step(page, 'Search for "witcher"', async () => {
      await page.getByTestId('search-input').fill('witcher');
      await expect(page.getByTestId('search-results')).toBeVisible();
    });

    await step(page, 'Check The Witcher 3 is the first result', async () => {
      await expect(page.getByTestId('game-card-title').first()).toHaveText(/The Witcher 3/);
      expect(await page.getByTestId('game-card').count()).toBeGreaterThan(3);
      await expect(page).toHaveURL(/\?q=witcher/);
    });
  });

  test('tells the user when nothing matches', async ({ page }) => {
    await step(page, 'Open the home page', async () => {
      await page.goto('/');
    });

    await step(page, 'Search for a title that does not exist', async () => {
      await page.getByTestId('search-input').fill('qzxv no such game 98765');
    });

    await step(page, 'Check the "no games found" message', async () => {
      await expect(page.getByTestId('search-empty')).toContainText('No games found');
      await expect(page.getByTestId('search-results')).toHaveCount(0);
    });
  });

  test('keeps the results after going back from a game page', async ({ page }) => {
    await step(page, 'Search for "hades"', async () => {
      await page.goto('/');
      await page.getByTestId('search-input').fill('hades');
      await expect(page.getByTestId('game-card-title').first()).toHaveText('Hades');
    });

    await step(page, 'Open the first result', async () => {
      await page.getByTestId('game-card').first().click();
      await expect(page.getByTestId('game-title')).toHaveText('Hades');
    });

    await step(page, 'Go back and check the results are still there', async () => {
      await page.getByTestId('back-button').click();
      await expect(page.getByTestId('search-input')).toHaveValue('hades');
      await expect(page.getByTestId('game-card-title').first()).toHaveText('Hades');
    });
  });

  test('clicking the logo returns to an empty home page', async ({ page }) => {
    await step(page, 'Search for "portal"', async () => {
      await page.goto('/');
      await page.getByTestId('search-input').fill('portal');
      await expect(page.getByTestId('search-results')).toBeVisible();
    });

    await step(page, 'Click the FindMyGame logo on the results page', async () => {
      await page.getByTestId('brand-link').click();
    });

    await step(page, 'Check the home page is back to its starting state', async () => {
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { name: 'Find your next game' })).toBeVisible();
      await expect(page.getByTestId('search-input')).toHaveValue('');
      await expect(page.getByTestId('search-input')).toBeFocused();
      await expect(page.getByTestId('search-results')).toHaveCount(0);
    });

    await step(page, 'Open a game page and click the logo there', async () => {
      await page.goto('/game/4200');
      await expect(page.getByTestId('game-title')).toHaveText('Portal 2');
      await page.getByTestId('brand-link').click();
    });

    await step(page, 'Check the home page is shown', async () => {
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { name: 'Find your next game' })).toBeVisible();
      await expect(page.getByTestId('search-input')).toHaveValue('');
    });
  });
});
