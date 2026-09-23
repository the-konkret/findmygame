import { test, expect } from '@playwright/test';
import { step, LOGGED_IN_STATE } from './support/step';

// These tests start logged in as the fresh account created by auth.setup.ts.
test.use({ storageState: LOGGED_IN_STATE });

test.describe('Favourites', () => {
  test('add a game to favourites, see it in the list, and remove it', async ({ page }) => {
    await step(page, 'Open The Witcher 3 page while logged in', async () => {
      await page.goto('/game/3328');
      await expect(page.getByTestId('favourite-button')).toHaveText('☆ Add to favourites');
    });

    await step(page, 'Add the game to favourites', async () => {
      await page.getByTestId('favourite-button').click();
      await expect(page.getByTestId('favourite-button')).toHaveText('★ In favourites');
    });

    await step(page, 'Reload and check the button shows "In favourites" straight away, with no flicker', async () => {
      // Record every label the favourite button shows while the page loads.
      await page.addInitScript(() => {
        const seen: string[] = [];
        (window as unknown as { favLabels: string[] }).favLabels = seen;
        new MutationObserver(() => {
          const label = document.querySelector('[data-testid="favourite-button"]')?.textContent;
          if (label && seen[seen.length - 1] !== label) seen.push(label);
        }).observe(document, { subtree: true, childList: true, characterData: true });
      });
      await page.reload();
      await expect(page.getByTestId('favourite-button')).toHaveText('★ In favourites');
      const labels = await page.evaluate(() => (window as unknown as { favLabels: string[] }).favLabels);
      expect(labels).toEqual(['★ In favourites']);
    });

    await step(page, 'Search "witcher" and check The Witcher 3 has a star, and the other results don\'t', async () => {
      const input = page.getByTestId('header-search').getByTestId('search-input');
      await input.fill('witcher');
      await input.press('Enter');
      const witcher3 = page.getByTestId('game-card').filter({ hasText: 'The Witcher 3: Wild Hunt' }).first();
      await expect(witcher3.getByTestId('favourite-badge')).toBeVisible();
      const witcher2 = page.getByTestId('game-card').filter({ hasText: 'The Witcher 2' }).first();
      await expect(witcher2).toBeVisible();
      await expect(witcher2.getByTestId('favourite-badge')).toHaveCount(0);
      await expect(page.getByTestId('favourite-badge')).toHaveCount(1);
    });

    await step(page, 'Open "My favourites" and find the game', async () => {
      await page.getByTestId('nav-favourites').click();
      await expect(page.getByRole('heading', { name: 'My favourites' })).toBeVisible();
      await expect(page.getByTestId('favourite-card-title')).toContainText(['The Witcher 3: Wild Hunt']);
    });

    await step(page, 'Open the game from the list and remove it from favourites', async () => {
      await page.getByTestId('favourite-card').filter({ hasText: 'The Witcher 3' }).click();
      await expect(page.getByTestId('game-title')).toHaveText('The Witcher 3: Wild Hunt');
      await page.getByTestId('favourite-button').click();
      await expect(page.getByTestId('favourite-button')).toHaveText('☆ Add to favourites');
    });

    await step(page, 'Check the list no longer has the game', async () => {
      await page.getByTestId('nav-favourites').click();
      await expect(page.getByTestId('favourites-empty')).toBeVisible();
    });

    await step(page, 'Search "witcher" again and check the star is gone', async () => {
      const input = page.getByTestId('header-search').getByTestId('search-input');
      await input.fill('witcher');
      await input.press('Enter');
      await expect(page.getByTestId('game-card-title').first()).toHaveText(/The Witcher 3/);
      await expect(page.getByTestId('favourite-badge')).toHaveCount(0);
    });
  });
});

test.describe('Notes', () => {
  const note = `Finish the co-op campaign with Ola. (test ${Date.now()})`;

  test('write a note, find it again after reloading, then delete it', async ({ page }) => {
    await step(page, 'Open the Portal 2 page while logged in', async () => {
      await page.goto('/game/4200');
      await expect(page.getByTestId('game-title')).toHaveText('Portal 2');
      await expect(page.getByTestId('notes-input')).toBeEnabled();
      await expect(page.getByTestId('notes-input')).toHaveValue('');
    });

    await step(page, 'Write a note and save it', async () => {
      await page.getByTestId('notes-input').fill(note);
      await page.getByTestId('notes-save').click();
      await expect(page.getByTestId('notes-status')).toHaveText('Saved ✓');
      await expect(page.getByTestId('notes-save')).toBeDisabled();
    });

    await step(page, 'Reload the page and check the note is still there', async () => {
      await page.reload();
      await expect(page.getByTestId('notes-input')).toHaveValue(note);
      await expect(page.getByTestId('notes-status')).toContainText('Last saved');
    });

    await step(page, 'Clear the note and save, which deletes it', async () => {
      await page.getByTestId('notes-input').fill('');
      await page.getByTestId('notes-save').click();
      await expect(page.getByTestId('notes-status')).toHaveText('Note deleted');
    });

    await step(page, 'Reload and check the note is gone', async () => {
      await page.reload();
      await expect(page.getByTestId('notes-input')).toBeEnabled();
      await expect(page.getByTestId('notes-input')).toHaveValue('');
    });
  });
});
