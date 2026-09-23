import { test, expect } from '@playwright/test';
import { step } from './support/step';

test.describe('Search', () => {
  test('finds a game and lists the best-known one first', async ({ page }) => {
    await step(page, 'Open the home page', async () => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Find your next game' })).toBeVisible();
      await expect(page.getByTestId('search-input')).toBeFocused();
    });

    await step(page, 'Type "witcher" and see suggestions', async () => {
      await page.getByTestId('search-input').fill('witcher');
      await expect(page.getByTestId('suggestion-title').first()).toHaveText(/The Witcher 3/);
    });

    await step(page, 'Press Enter to see all results', async () => {
      await page.getByTestId('search-input').press('Enter');
      await expect(page.getByTestId('search-results')).toBeVisible();
      await expect(page.getByTestId('search-suggestions')).toHaveCount(0);
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

    await step(page, 'Type a title that does not exist', async () => {
      await page.getByTestId('search-input').fill('qzxv no such game 98765');
      await expect(page.getByTestId('suggestions-none')).toHaveText('No matching games');
    });

    await step(page, 'Press Enter and check the "no games found" message', async () => {
      await page.getByTestId('search-input').press('Enter');
      await expect(page.getByTestId('search-empty')).toContainText('No games found');
      await expect(page.getByTestId('search-results')).toHaveCount(0);
    });
  });

  test('keeps the results after going back from a game page', async ({ page }) => {
    await step(page, 'Search for "hades"', async () => {
      await page.goto('/');
      await page.getByTestId('search-input').fill('hades');
      await page.getByTestId('search-input').press('Enter');
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

    await step(page, 'Check the search box is not active and no suggestions pop up', async () => {
      await expect(page.getByTestId('search-input')).not.toBeFocused();
      // wait longer than the suggestions delay, then make sure the list stayed closed
      await page.waitForTimeout(1_000);
      await expect(page.getByTestId('search-suggestions')).toHaveCount(0);
    });
  });

  test('clicking the logo returns to an empty home page', async ({ page }) => {
    await step(page, 'Search for "portal"', async () => {
      await page.goto('/');
      await page.getByTestId('search-input').fill('portal');
      await page.getByTestId('search-input').press('Enter');
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

  test('opens a game straight from the suggestions with the mouse', async ({ page }) => {
    await step(page, 'Type "portal 2"', async () => {
      await page.goto('/');
      await page.getByTestId('search-input').fill('portal 2');
      await expect(page.getByTestId('search-suggestions')).toBeVisible();
    });

    await step(page, 'Click the "Portal 2" suggestion', async () => {
      await page.getByTestId('suggestion').filter({ hasText: /^Portal 2\d{4}$/ }).first().click();
    });

    await step(page, 'Check the Portal 2 page is open', async () => {
      await expect(page).toHaveURL(/\/game\/4200$/);
      await expect(page.getByTestId('game-title')).toHaveText('Portal 2');
    });
  });

  test('suggestions work with the keyboard', async ({ page }) => {
    await step(page, 'Type "hades"', async () => {
      await page.goto('/');
      await page.getByTestId('search-input').fill('hades');
      await expect(page.getByTestId('suggestion-title').first()).toHaveText('Hades');
    });

    await step(page, 'Press Escape to close the suggestions', async () => {
      await page.getByTestId('search-input').press('Escape');
      await expect(page.getByTestId('search-suggestions')).toHaveCount(0);
    });

    await step(page, 'Press Down to reopen them and highlight the first game', async () => {
      await page.getByTestId('search-input').press('ArrowDown');
      await expect(page.getByTestId('suggestion').first()).toBeVisible();
      await page.getByTestId('search-input').press('ArrowDown');
      await expect(page.getByTestId('suggestion').first()).toHaveAttribute('aria-selected', 'true');
    });

    await step(page, 'Press Enter to open the highlighted game', async () => {
      await page.getByTestId('search-input').press('Enter');
      await expect(page.getByTestId('game-title')).toHaveText('Hades');
    });
  });

  test('puts the right game first for tricky searches', async ({ page }) => {
    const cases: [string, string][] = [
      ['portal 2', 'Portal 2'], // not GTA V, which is more popular
      ['gta', 'Grand Theft Auto V'], // initials
      ['baldurs gate 3', "Baldur's Gate III"], // apostrophe and Roman numeral
    ];
    await page.goto('/');
    for (const [typed, expected] of cases) {
      await step(page, `Type "${typed}" and expect "${expected}" first`, async () => {
        await page.getByTestId('search-input').fill(typed);
        await expect(page.getByTestId('suggestion-title').first()).toHaveText(expected);
      });
    }
  });

  test('the top bar on a game page has its own search box', async ({ page }) => {
    await step(page, 'Open the Portal 2 page', async () => {
      await page.goto('/game/4200');
      await expect(page.getByTestId('game-title')).toHaveText('Portal 2');
      await expect(page.getByTestId('header-search')).toBeVisible();
      await expect(page.getByTestId('search-input')).not.toBeFocused();
    });

    await step(page, 'Type "hades" in the top bar and pick it from the suggestions', async () => {
      const box = page.getByTestId('header-search');
      await box.getByTestId('search-input').fill('hades');
      await box.getByTestId('suggestion').filter({ hasText: /^Hades\d{4}$/ }).click();
    });

    await step(page, 'Check the Hades page opened and the top bar search is empty again', async () => {
      await expect(page.getByTestId('game-title')).toHaveText('Hades');
      await expect(page.getByTestId('header-search').getByTestId('search-input')).toHaveValue('');
    });

    await step(page, 'Type "witcher" in the top bar and press Enter for all results', async () => {
      const input = page.getByTestId('header-search').getByTestId('search-input');
      await input.fill('witcher');
      await input.press('Enter');
    });

    await step(page, 'Check the results page shows the Witcher games', async () => {
      await expect(page).toHaveURL(/\/\?q=witcher$/);
      await expect(page.getByTestId('game-card-title').first()).toHaveText(/The Witcher 3/);
      await expect(page.getByTestId('header-search')).toHaveCount(0);
    });
  });

  test('"Surprise me" opens a random game', async ({ page }) => {
    await step(page, 'Open the home page and find the "Surprise me" button next to the search box', async () => {
      await page.goto('/');
      const button = page.getByTestId('surprise-button');
      await expect(button).toHaveText(/Surprise me/);
      const buttonBox = (await button.boundingBox())!;
      const searchBox = (await page.getByTestId('search-input').boundingBox())!;
      expect(buttonBox.x).toBeGreaterThan(searchBox.x + searchBox.width); // to the right of the search box
    });

    await step(page, 'Click "Surprise me"', async () => {
      await page.getByTestId('surprise-button').click();
    });

    await step(page, 'Check a game page opened', async () => {
      await expect(page).toHaveURL(/\/game\/\d+$/);
      await expect(page.getByTestId('game-title')).not.toBeEmpty();
    });

    await step(page, 'Go back and check the button is only on the fresh home page, not on results', async () => {
      await page.goto('/?q=portal');
      await expect(page.getByTestId('search-results')).toBeVisible();
      await expect(page.getByTestId('surprise-button')).toHaveCount(0);
    });
  });

  test('suggestions stay open when the phone keyboard is closed, and close when tapping elsewhere', async ({ page }) => {
    await step(page, 'Type "hades" and see suggestions', async () => {
      await page.goto('/');
      await page.getByTestId('search-input').fill('hades');
      await expect(page.getByTestId('suggestion-title').first()).toHaveText('Hades');
    });

    await step(page, 'Close the keyboard (the box loses focus, like tapping ✓ on an iPhone): suggestions stay', async () => {
      await page.getByTestId('search-input').evaluate((el: HTMLInputElement) => el.blur());
      await expect(page.getByTestId('search-input')).not.toBeFocused();
      await page.waitForTimeout(500);
      await expect(page.getByTestId('search-suggestions')).toBeVisible();
    });

    await step(page, 'Tap a suggestion: it still opens the game', async () => {
      await page.getByTestId('suggestion').first().click();
      await expect(page.getByTestId('game-title')).toHaveText('Hades');
    });

    await step(page, 'Type again in the top bar, then tap somewhere else on the page: suggestions close', async () => {
      const input = page.getByTestId('header-search').getByTestId('search-input');
      await input.fill('portal');
      await expect(page.getByTestId('search-suggestions')).toBeVisible();
      await page.getByTestId('game-title').click();
      await expect(page.getByTestId('search-suggestions')).toHaveCount(0);
    });
  });
});
