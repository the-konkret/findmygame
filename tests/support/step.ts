import { test, type Page } from '@playwright/test';

/**
 * A named test step that ends with a screenshot, so the report shows every step with a picture of the page.
 * The screenshot is taken even if the step fails, so you can see what went wrong.
 *
 *   await step(page, 'Search for "witcher"', async () => { ... });
 */
export async function step<T>(page: Page, title: string, body: () => Promise<T>): Promise<T> {
  return test.step(title, async () => {
    try {
      return await body();
    } finally {
      if (!page.isClosed()) {
        // Wait a moment for images and loading states to settle so the picture matches the check.
        await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => {});
        const screenshot = await page.screenshot().catch(() => null);
        if (screenshot) {
          await test.info().attach(`Screenshot – ${title}`, { body: screenshot, contentType: 'image/png' });
        }
      }
    }
  });
}

/** A unique throwaway email for test accounts. Emails are never sent (email confirmation is off). */
export function uniqueEmail(prefix = 'fmg-test'): string {
  const domain = process.env.TEST_EMAIL_DOMAIN ?? 'mailinator.com';
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@${domain}`;
}

export const TEST_PASSWORD = 'Test-Password-123!';

/** Where the logged-in browser state from auth.setup.ts is saved (git-ignored). */
export const LOGGED_IN_STATE = 'playwright/.auth/user.json';
