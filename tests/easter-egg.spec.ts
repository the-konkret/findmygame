import { test, expect } from '@playwright/test';
import { step } from './support/step';

test.describe('Easter egg', () => {
  test('5 quick clicks on the magnifying glass make it rain faces; Escape and reload stop it', async ({ page }) => {
    const glass = page.getByTestId('search-icon').first();

    await step(page, 'Open the home page and click the magnifying glass 4 times: nothing happens', async () => {
      await page.goto('/');
      for (let i = 0; i < 4; i++) await glass.click();
      await page.waitForTimeout(300);
      await expect(page.getByTestId('face-rain')).toHaveCount(0);
    });

    await step(page, 'Click it a 5th time: faces start raining', async () => {
      await glass.click();
      await expect(page.getByTestId('face-rain')).toBeAttached();
      await expect.poll(() => page.getByTestId('face-drop').count()).toBeGreaterThan(3);
      await page.waitForTimeout(800); // let the screenshot catch some mid-fall
    });

    await step(page, 'The page still works underneath: type a search while it rains', async () => {
      await page.getByTestId('search-input').first().fill('portal');
      await expect(page.getByTestId('search-suggestions')).toBeVisible();
    });

    await step(page, 'Press Escape: the rain stops', async () => {
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('face-rain')).toHaveCount(0);
    });

    await step(page, 'Start it again from the top-bar search on a game page, then reload: it is gone', async () => {
      await page.goto('/game/4200');
      const topGlass = page.getByTestId('header-search').getByTestId('search-icon');
      for (let i = 0; i < 5; i++) await topGlass.click();
      await expect(page.getByTestId('face-rain')).toBeAttached();
      await page.reload();
      await expect(page.getByTestId('game-title')).toBeVisible();
      await expect(page.getByTestId('face-rain')).toHaveCount(0);
    });
  });

  test('slow clicks do not count', async ({ page }) => {
    await step(page, 'Click the magnifying glass 5 times, 2 seconds apart', async () => {
      await page.goto('/');
      for (let i = 0; i < 5; i++) {
        await page.getByTestId('search-icon').first().click();
        if (i < 4) await page.waitForTimeout(2_000);
      }
    });

    await step(page, 'Check no faces fall', async () => {
      await page.waitForTimeout(300);
      await expect(page.getByTestId('face-rain')).toHaveCount(0);
    });
  });
});
