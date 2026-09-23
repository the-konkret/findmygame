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
