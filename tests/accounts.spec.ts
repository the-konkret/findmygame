import { test, expect } from '@playwright/test';
import { step, uniqueEmail, TEST_PASSWORD } from './support/step';

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
      await expect(page.getByTestId('nav-user')).toHaveText(email);
    });

    await step(page, 'Log out', async () => {
      await page.getByTestId('nav-logout').click();
      await expect(page.getByTestId('nav-login')).toBeVisible();
      await expect(page.getByTestId('nav-user')).toHaveCount(0);
    });

    await step(page, 'Log back in with the same account', async () => {
      await page.getByTestId('nav-login').click();
      await page.getByTestId('auth-email').fill(email);
      await page.getByTestId('auth-password').fill(TEST_PASSWORD);
      await page.getByTestId('auth-submit').click();
      await expect(page.getByTestId('nav-user')).toHaveText(email);
    });
  });

  test('rejects a wrong password', async ({ page }) => {
    await step(page, 'Open the log-in form', async () => {
      await page.goto('/login');
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
});
