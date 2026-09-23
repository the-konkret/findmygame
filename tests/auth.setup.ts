import { test as setup, expect } from '@playwright/test';
import { step, uniqueEmail, TEST_PASSWORD, LOGGED_IN_STATE } from './support/step';

// Runs once before the other tests: signs up a brand-new account and saves the logged-in browser state,
// so favourites and notes tests start already logged in and never see data from earlier runs.

setup('create a logged-in test account', async ({ page }) => {
  const email = uniqueEmail();

  await step(page, 'Open the sign-up form', async () => {
    await page.goto('/login');
    await page.getByTestId('tab-signup').click();
    await expect(page.getByTestId('auth-submit')).toHaveText('Create account');
  });

  await step(page, `Sign up as ${email}`, async () => {
    await page.getByTestId('auth-email').fill(email);
    await page.getByTestId('auth-password').fill(TEST_PASSWORD);
    await page.getByTestId('auth-submit').click();
  });

  await step(page, 'Check the account is logged in', async () => {
    await expect(page.getByTestId('nav-user')).toHaveText(email);
  });

  await page.context().storageState({ path: LOGGED_IN_STATE });
});
