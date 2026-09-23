import { test, expect } from '@playwright/test';
import { step, uniqueEmail, TEST_PASSWORD, LOGGED_IN_STATE } from './support/step';

test.describe('Accounts', () => {
  test('sign up, log out and log back in', async ({ page }) => {
    const email = uniqueEmail('fmg-signup');

    await step(page, 'Open the sign-up form', async () => {
      await page.goto('/');
      await page.getByTestId('nav-login').click();
      await page.getByTestId('tab-signup').click();
    });

    await step(page, 'Create a new account', async () => {
      await page.getByTestId('auth-email').fill(email);
      await page.getByTestId('auth-password').fill(TEST_PASSWORD);
      await page.getByTestId('auth-submit').click();
      await expect(page.getByTestId('nav-account')).toBeVisible();
    });

    await step(page, 'Check the top bar shows the cog, not the email', async () => {
      await expect(page.locator('.topbar')).not.toContainText(email);
    });

    await step(page, 'Open the account page with the cog and check the email is there', async () => {
      await page.getByTestId('nav-account').click();
      await expect(page).toHaveURL(/\/account$/);
      await expect(page.getByTestId('account-email')).toHaveText(email);
    });

    await step(page, 'Log out from the account page', async () => {
      await page.getByTestId('account-logout').click();
      await expect(page.getByTestId('nav-login')).toBeVisible();
      await expect(page.getByTestId('nav-account')).toHaveCount(0);
    });

    await step(page, 'Check logging out landed on the home page', async () => {
      await expect(page).toHaveURL(/\/$/);
    });

    await step(page, 'Log back in with the same account and land on the home page, not Account', async () => {
      await page.getByTestId('nav-login').click();
      await page.getByTestId('auth-email').fill(email);
      await page.getByTestId('auth-password').fill(TEST_PASSWORD);
      await page.getByTestId('auth-submit').click();
      await expect(page.getByTestId('nav-account')).toBeVisible();
      await expect(page).toHaveURL(/\/$/);
    });

    await step(page, 'Point at the cog: a menu with Settings and Log out appears', async () => {
      await page.getByTestId('nav-account').hover();
      const menu = page.getByTestId('account-menu');
      await expect(menu).toBeVisible();
      await expect(menu.getByRole('menuitem')).toHaveText(['Settings', 'Log out']);
    });

    await step(page, 'Move the mouse away: the menu closes', async () => {
      await page.getByRole('heading', { name: 'Find your next game' }).hover();
      await expect(page.getByTestId('account-menu')).toHaveCount(0);
    });

    await step(page, 'Open the menu and choose Settings', async () => {
      await page.getByTestId('nav-account').hover();
      await page.getByTestId('menu-settings').click();
      await expect(page).toHaveURL(/\/account$/);
    });

    await step(page, 'Open the menu and choose Log out: back on the home page, logged out', async () => {
      await page.getByTestId('nav-account').hover();
      await page.getByTestId('menu-logout').click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByTestId('nav-login')).toBeVisible();
    });
  });

  test('rejects a wrong password', async ({ page }) => {
    await step(page, 'Open the log-in form (on a computer the top-bar search is still there)', async () => {
      await page.goto('/login');
      await expect(page.getByTestId('header-search')).toBeVisible();
    });

    await step(page, 'Try to log in with a wrong password', async () => {
      await page.getByTestId('auth-email').fill(uniqueEmail('fmg-nobody'));
      await page.getByTestId('auth-password').fill('definitely-wrong-password');
      await page.getByTestId('auth-submit').click();
    });

    await step(page, 'Check the error message and that nobody is logged in', async () => {
      await expect(page.getByTestId('auth-error')).toHaveText('Wrong email or password.');
      await expect(page.getByTestId('nav-login')).toBeVisible();
    });
  });

  test('sends logged-out visitors from "My favourites" to the log-in page', async ({ page }) => {
    await step(page, 'Open My favourites without logging in', async () => {
      await page.goto('/favourites');
    });

    await step(page, 'Check the log-in page is shown instead', async () => {
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByTestId('auth-card')).toBeVisible();
    });
  });

  test.describe('profile picture', () => {
    test.use({ storageState: LOGGED_IN_STATE });

    test('upload a picture, keep it after reloading, reject big or wrong files, remove it', async ({ page }) => {
      await step(page, 'Open the account page: no picture yet, just the first letter', async () => {
        await page.goto('/account');
        await expect(page.getByTestId('avatar-initial')).toBeVisible();
      });

      await step(page, 'Upload a picture', async () => {
        // Draw a 400×300 test picture in the browser and use it as the file.
        const dataUrl = await page.evaluate(() => {
          const c = document.createElement('canvas');
          c.width = 400;
          c.height = 300;
          const g = c.getContext('2d')!;
          g.fillStyle = '#e8650a';
          g.fillRect(0, 0, 400, 300);
          g.fillStyle = '#111';
          g.fillRect(120, 70, 160, 160);
          return c.toDataURL('image/png');
        });
        await page.getByTestId('avatar-input').setInputFiles({
          name: 'me.png',
          mimeType: 'image/png',
          buffer: Buffer.from(dataUrl.split(',')[1], 'base64'),
        });
        await expect(page.getByTestId('avatar-image')).toHaveAttribute('src', /\/storage\/v1\/object\/public\/avatars\//);
        await expect(page.getByTestId('avatar-error')).toHaveCount(0);
      });

      await step(page, 'Check the top bar shows the picture instead of the cog', async () => {
        const account = page.getByTestId('nav-account');
        await expect(account.getByTestId('nav-avatar')).toBeVisible();
        await expect(account.locator('svg')).toHaveCount(0);
        await expect
          .poll(() => account.getByTestId('nav-avatar').evaluate((el: HTMLImageElement) => el.naturalWidth))
          .toBeGreaterThan(0); // the picture really loaded
      });

      await step(page, 'Reload: the picture is still there, and it is small (256×256)', async () => {
        await page.reload();
        const img = page.getByTestId('avatar-image');
        await expect(img).toBeVisible();
        await expect
          .poll(() => img.evaluate((el: HTMLImageElement) => `${el.naturalWidth}x${el.naturalHeight}`))
          .toBe('256x256');
      });

      await step(page, 'Try a picture over 1 MB: it is refused', async () => {
        await page.getByTestId('avatar-input').setInputFiles({
          name: 'huge.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.alloc(1_500_000, 1),
        });
        await expect(page.getByTestId('avatar-error')).toContainText('under 1 MB');
      });

      await step(page, 'Try a file that is not a picture: it is refused', async () => {
        await page.getByTestId('avatar-input').setInputFiles({
          name: 'notes.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('hello'),
        });
        await expect(page.getByTestId('avatar-error')).toContainText('JPG, PNG or WebP');
      });

      await step(page, 'Remove the picture: back to the first letter', async () => {
        await page.getByTestId('avatar-remove').click();
        await expect(page.getByTestId('avatar-initial')).toBeVisible();
        await expect(page.getByTestId('avatar-image')).toHaveCount(0);
      });

      await step(page, 'Check the top bar shows the cog again', async () => {
        const account = page.getByTestId('nav-account');
        await expect(account.getByTestId('nav-avatar')).toHaveCount(0);
        await expect(account.locator('svg')).toBeVisible();
      });
    });
  });
});
