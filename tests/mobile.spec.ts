import { test, expect, type Page } from '@playwright/test';
import { step, LOGGED_IN_STATE } from './support/step';

// These tests run on a phone-sized screen (see the "mobile" project in playwright.config.ts).

/** Nothing on the page is wider than the screen, so there's no sideways scrolling. */
async function expectNoSideScroll(page: Page) {
  const { contentWidth, screenWidth } = await page.evaluate(() => ({
    contentWidth: document.documentElement.scrollWidth,
    screenWidth: window.innerWidth,
  }));
  expect(contentWidth, 'page is wider than the screen').toBeLessThanOrEqual(screenWidth);
}

/** Text boxes need 16px text or bigger, otherwise iPhones zoom the whole page in when you tap them. */
async function expectNoZoomOnTap(page: Page, testId: string) {
  const size = await page.getByTestId(testId).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size, `${testId} text size`).toBeGreaterThanOrEqual(16);
}

test.describe('Phone layout', () => {
  test('home page, suggestions and results fit a phone screen', async ({ page }) => {
    await step(page, 'Open the home page on a phone', async () => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Find your next game' })).toBeVisible();
      await expectNoSideScroll(page);
      await expectNoZoomOnTap(page, 'search-input');
    });

    await step(page, 'Check "Surprise me" sits under the search box on a phone', async () => {
      const button = (await page.getByTestId('surprise-button').boundingBox())!;
      const search = (await page.getByTestId('search-input').boundingBox())!;
      expect(button.y).toBeGreaterThan(search.y + search.height - 1);
      expect(button.x + button.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    });

    await step(page, 'Type "witcher" and check the suggestions fit on screen', async () => {
      await page.getByTestId('search-input').fill('witcher');
      const list = page.getByTestId('search-suggestions');
      await expect(page.getByTestId('suggestion-title').first()).toHaveText(/The Witcher 3/);
      const box = (await list.boundingBox())!;
      const width = page.viewportSize()!.width;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    });

    await step(page, 'Press Enter and check the results are a list: picture on the left, title on the right', async () => {
      await page.getByTestId('search-input').press('Enter');
      const card = page.getByTestId('game-card').first();
      await expect(card).toBeVisible();
      const picture = (await card.locator('.card-image').boundingBox())!;
      const title = (await card.getByTestId('game-card-title').boundingBox())!;
      expect(title.x).toBeGreaterThan(picture.x + picture.width - 1); // title is to the right of the picture
      expect(title.y).toBeLessThan(picture.y + picture.height); // on the same row
      await expectNoSideScroll(page);
    });
  });

  test('game page shows deals, notes, description and details in that order', async ({ page }) => {
    await step(page, 'Open The Witcher 3 page on a phone', async () => {
      await page.goto('/game/3328');
      await expect(page.getByTestId('game-title')).toBeVisible();
      await expectNoSideScroll(page);
    });

    await step(page, 'Check the order of the sections', async () => {
      const top = async (testId: string) => (await page.getByTestId(testId).boundingBox())!.y;
      const deals = await top('deals-panel');
      const notes = await top('notes-panel');
      const about = await top('game-description');
      const details = await top('game-facts');
      expect(deals).toBeLessThan(notes);
      expect(notes).toBeLessThan(about);
      expect(about).toBeLessThan(details);
    });

    await step(page, 'Check the top-bar search sits on its own full-width row', async () => {
      const search = (await page.getByTestId('header-search').boundingBox())!;
      const logo = (await page.getByTestId('brand-link').boundingBox())!;
      expect(search.y).toBeGreaterThan(logo.y + logo.height - 1);
      expect(search.width).toBeGreaterThan(page.viewportSize()!.width * 0.8);
      await expectNoZoomOnTap(page, 'search-input');
    });
  });

  test('log-in form works without zooming', async ({ page }) => {
    await step(page, 'Open the log-in page on a phone', async () => {
      await page.goto('/login');
      await expect(page.getByTestId('auth-card')).toBeVisible();
      await expectNoSideScroll(page);
      await expectNoZoomOnTap(page, 'auth-email');
      await expectNoZoomOnTap(page, 'auth-password');
    });

    await step(page, 'Check there is no search box in the top bar on the log-in page', async () => {
      await expect(page.getByTestId('header-search')).toBeHidden();
    });
  });

  test.describe('logged in', () => {
    test.use({ storageState: LOGGED_IN_STATE });

    test('top bar fits on one line and the notes box does not zoom', async ({ page }) => {
      await step(page, 'Open the Portal 2 page, logged in, on a phone', async () => {
        await page.goto('/game/4200');
        await expect(page.getByTestId('nav-account')).toBeVisible();
        await expectNoSideScroll(page);
      });

      await step(page, 'Check logo, favourites and the cog share one row', async () => {
        const logo = (await page.getByTestId('brand-link').boundingBox())!;
        const favourites = (await page.getByTestId('nav-favourites').boundingBox())!;
        const logout = (await page.getByTestId('nav-account').boundingBox())!;
        const middle = (b: { y: number; height: number }) => b.y + b.height / 2;
        expect(Math.abs(middle(favourites) - middle(logo))).toBeLessThan(12);
        expect(Math.abs(middle(logout) - middle(logo))).toBeLessThan(12);
        expect(logout.x + logout.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      });

      await step(page, 'Check the notes box does not make the phone zoom', async () => {
        await expect(page.getByTestId('notes-input')).toBeVisible();
        await expectNoZoomOnTap(page, 'notes-input');
      });
    });
  });
});
