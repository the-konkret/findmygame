import { test, expect } from '@playwright/test';
import { step } from './support/step';

const WITCHER_3 = '/game/3328';

test.describe('Game page', () => {
  test('shows the game summary', async ({ page }) => {
    await step(page, 'Open The Witcher 3 page', async () => {
      await page.goto(WITCHER_3);
      await expect(page.getByTestId('game-title')).toHaveText('The Witcher 3: Wild Hunt');
    });

    await step(page, 'Check score, description and details', async () => {
      await expect(page.getByTestId('game-metacritic')).toContainText('Metacritic');
      await expect(page.getByTestId('game-description')).not.toBeEmpty();
      const facts = page.getByTestId('game-facts');
      await expect(facts).toContainText('Platforms');
      await expect(facts).toContainText('PC');
      await expect(facts).toContainText('CD PROJEKT RED');
      await expect(facts.getByRole('link', { name: /View on RAWG/ })).toHaveAttribute('href', /rawg\.io\/games\//);
    });
  });

  test('shows store prices from CheapShark', async ({ page }) => {
    await step(page, 'Open The Witcher 3 page', async () => {
      await page.goto(WITCHER_3);
      await expect(page.getByTestId('deals-panel')).toBeVisible();
    });

    await step(page, 'Wait for prices to load', async () => {
      await expect(page.getByTestId('deals-loading')).toBeHidden({ timeout: 20_000 });
      await expect(page.getByTestId('deals-error')).toHaveCount(0);
    });

    await step(page, 'Check the best price and the store list', async () => {
      await expect(page.getByTestId('deals-best')).toContainText('$');
      const rows = page.getByTestId('deal-row');
      expect(await rows.count()).toBeGreaterThan(0);
      await expect(rows.first().getByTestId('deal-price')).toHaveText(/^\$\d+\.\d{2}$/);
      await expect(rows.first().getByRole('link')).toHaveAttribute('href', /cheapshark\.com\/redirect\?dealID=/);
    });
  });

  test('asks logged-out visitors to log in for favourites and notes', async ({ page }) => {
    await step(page, 'Open a game page without logging in', async () => {
      await page.goto(WITCHER_3);
      await expect(page.getByTestId('game-title')).toBeVisible();
    });

    await step(page, 'Check the log-in prompts', async () => {
      await expect(page.getByTestId('favourite-login')).toHaveAttribute('aria-label', 'Log in to add to favourites');
      await expect(page.getByTestId('wishlist-login')).toContainText('Log in to add to wishlist');
      // the star icon and the text sit exactly in the middle of the button, top to bottom
      const button = (await page.getByTestId('wishlist-login').boundingBox())!;
      for (const part of [page.getByTestId('wishlist-login').locator('svg'), page.getByTestId('wishlist-login').locator('span')]) {
        const box = (await part.boundingBox())!;
        expect(Math.abs(box.y + box.height / 2 - (button.y + button.height / 2))).toBeLessThanOrEqual(1);
      }
      await expect(page.getByTestId('notes-login')).toBeVisible();
      await expect(page.getByTestId('favourite-button')).toHaveCount(0);
      await expect(page.getByTestId('wishlist-button')).toHaveCount(0);
    });

    await step(page, 'Follow the prompt to the log-in page', async () => {
      await page.getByTestId('favourite-login').click();
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByTestId('auth-card')).toBeVisible();
    });
  });

  test('shows a friendly page for unknown addresses', async ({ page }) => {
    await step(page, 'Open an address that does not exist', async () => {
      await page.goto('/this-page-does-not-exist');
      await expect(page.getByText('Page not found')).toBeVisible();
    });
  });

  test('shows skeleton placeholders while pictures load', async ({ page }) => {
    // Hold every RAWG picture back for 2 seconds, so the loading state can be seen.
    await page.route('https://media.rawg.io/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      await route.continue();
    });

    await step(page, 'Search for "portal" with slow pictures and see skeletons on the cards', async () => {
      await page.goto('/?q=portal');
      await expect(page.getByTestId('game-card').first()).toBeVisible();
      await expect(page.getByTestId('game-card').first().getByTestId('image-skeleton')).toBeVisible();
    });

    await step(page, 'Wait for the pictures and check the skeletons are replaced', async () => {
      const firstCard = page.getByTestId('game-card').first();
      await expect(firstCard.getByTestId('image-skeleton')).toHaveCount(0, { timeout: 15_000 });
      await expect(firstCard.locator('img.loaded')).toBeVisible();
    });

    await step(page, 'Open the game page and see the big picture load the same way', async () => {
      // Hades: its picture wasn't on the "portal" results, so it isn't in the browser's memory yet
      await page.goto('/game/274755');
      await expect(page.getByTestId('game-title')).toHaveText('Hades');
      const hero = page.locator('.game-hero');
      await expect(hero.getByTestId('image-skeleton')).toBeVisible();
      await expect(hero.getByTestId('image-skeleton')).toHaveCount(0, { timeout: 15_000 });
      await expect(hero.locator('img.loaded')).toBeVisible();
    });
  });
});
