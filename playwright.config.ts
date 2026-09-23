import { defineConfig, devices } from '@playwright/test';

// Which site to test:
//   npm test                                                        → your computer (starts `npm run dev` itself)
//   $env:BASE_URL="https://findmygame.mktestbb.workers.dev"; npm test → the live website
const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const testingLocally = !process.env.BASE_URL;

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Real outside services (RAWG, CheapShark, Supabase) are involved, so allow one retry on CI.
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,

  reporter: [
    ['list'],
    // Playwright's own report (backup): npx playwright show-report
    ['html', { open: 'never' }],
    // Allure report with steps and a screenshot for every step: npm run report
    ['allure-playwright', { resultsDir: 'allure-results' }],
  ],

  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Creates a fresh test account and saves its login for the tests that need one.
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],

  webServer: testingLocally
    ? {
        command: 'npm run dev',
        url: BASE_URL,
        reuseExistingServer: true, // if `npm run dev` is already running, use it
        timeout: 60_000,
      }
    : undefined,
});
