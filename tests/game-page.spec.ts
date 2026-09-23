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
      await expect(page.getByTestId('favourite-login')).toContainText('Log in to add to favourites');
      await expect(page.getByTestId('notes-login')).toBeVisible();
      await expect(page.getByTestId('favourite-button')).toHaveCount(0);
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
});
