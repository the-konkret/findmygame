# FindMyGame

A website for searching video games, checking discounts across PC stores, and keeping favourites and notes.
Built with React + TypeScript + Vite and hosted for free on Cloudflare Workers.

## Roadmap

- [x] Game search (RAWG)
- [x] Game summary page
- [x] Discounts across PC stores (CheapShark)
- [x] Website hosting on Cloudflare Workers, API key kept on the server
- [x] User accounts with favourites and notes (Supabase)
- [x] Playwright tests with an Allure report (steps and screenshots)
- [x] GitHub Actions runs the tests on every push and publishes the report
- [ ] Later: installable on phones (PWA)

## Run it on your computer (Windows)

Requirements: Node.js LTS and Git.

```powershell
cd findmygame
npm install        # first time, and after package.json changes
npm run dev        # open http://127.0.0.1:5173 in your browser
```

| Command | What it does |
|---|---|
| `npm run dev` | Runs the site locally with live reload |
| `npm run build` | Builds the production site into `dist/` |
| `npm run preview` | Serves the built `dist/` locally to check it |
| `npm run typecheck` | Checks the TypeScript code for errors |

## API key

The RAWG key is a secret and never reaches the visitor's browser:

- **On your computer** it lives in `.env` as `RAWG_API_KEY=...`. `.gitignore` keeps that file off GitHub, and `vite.config.ts` adds the key to requests.
- **Online** it's stored in Cloudflare as a secret, and `worker/index.ts` adds it to requests.

To set up your own copy, copy `.env.example` to `.env` and add a free key from https://rawg.io/apidocs.

## Automated tests (Playwright + Allure)

End-to-end tests drive a real Chrome browser through the site, just like a person would.
Every test is split into named steps, and each step ends with a screenshot, so the report shows what the page looked like at every point.

First time only:

```powershell
npm install
npx playwright install chromium
```

| Command | What it does |
|---|---|
| `npm test` | Runs all tests against your computer (starts `npm run dev` if it isn't running) |
| `npm run test:live` | Runs all tests against the live website |
| `npm run test:ui` | Opens Playwright's visual runner: pick tests, watch them run, step through them |
| `npm run report` | Builds the Allure report (steps and screenshots) and opens it in your browser |
| `npx playwright show-report` | Opens Playwright's own HTML report (includes traces for failed tests) |

What's covered:

| File | Tests |
|---|---|
| `tests/search.spec.ts` | suggestions dropdown (mouse and keyboard), full results and order, "no games found", results kept after going back, logo returns home |
| `tests/game-page.spec.ts` | game summary, CheapShark prices, log-in prompts for visitors, unknown pages |
| `tests/accounts.spec.ts` | sign up, log out, log in, wrong password, protected favourites page |
| `tests/favourites-and-notes.spec.ts` | add, list and remove a favourite; save, reload and delete a note |
| `tests/auth.setup.ts` | runs first: creates a fresh test account for the logged-in tests |

Each run signs up new throwaway accounts (`fmg-test-...@mailinator.com`), so runs never interfere with each other.
You can delete old test users in Supabase under **Authentication → Users**.
The helper `step()` in `tests/support/step.ts` adds the screenshot to each step.

### Tests on GitHub (GitHub Actions)

`.github/workflows/tests.yml` runs the tests on GitHub's computers (free for public repositories):

| When | What is tested |
|---|---|
| Every push to `main`, every pull request | the code in that commit, on a temporary dev server |
| Mondays and Thursdays, 06:00 UTC | the live website (this also keeps the free Supabase project from pausing) |
| By hand: **Actions → Tests → Run workflow** | your choice: `live` or `local` |

The latest Allure report is published at **https://the-konkret.github.io/findmygame/**.
Both reports can also be downloaded from each run's page under **Artifacts** (kept for 14 days).

One-time setup on GitHub:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → New repository secret**: name `RAWG_API_KEY`, value your RAWG key.

## Accounts, favourites and notes (Supabase, free)

Logins, favourites and notes are stored in Supabase (a free hosted Postgres database with sign-in built in).

One-time setup:

1. In Supabase, open **SQL Editor → New query**, paste all of `supabase/schema.sql`, and click **Run**.
   This creates the `favourites` and `notes` tables and the security rules (each person sees only their own data).
2. **Authentication → Sign In / Providers → Email**: turn off **Confirm email**. The free plan can only send a few emails an hour,
   and the automated tests need to create accounts. Turn it back on later with your own email sender if you want.
3. **Authentication → URL Configuration**: set **Site URL** to the live address, and add `http://127.0.0.1:5173/**` under **Redirect URLs**.
4. Put the project URL and publishable key in `src/lib/supabase.ts`. Both are public by design; the database rules protect the data.

Free-plan note: Supabase pauses a project after 7 days without activity. The twice-weekly scheduled test run keeps it awake.

## Deploying (Cloudflare Workers, free)

The site runs as a Cloudflare Worker: `dist/` is served as static files, and `worker/index.ts` handles `/api/rawg/...`.
Settings live in `wrangler.jsonc`.

One-time setup in the Cloudflare dashboard (**Workers & Pages** → the `findmygame` Worker):

1. **Settings → Build**: build command `npm run build`, deploy command `npx wrangler deploy`.
2. **Settings → Variables and Secrets**: add `RAWG_API_KEY` with type **Secret**. Secrets are kept across deploys.
3. The Worker name must match `"name"` in `wrangler.jsonc` (`findmygame`).

After that, every `git push` to `main` rebuilds and redeploys the site. Its address is `https://findmygame.<your-subdomain>.workers.dev`.

## Project layout

```
src/pages/                   Search, Game, Login and Favourites pages
src/components/              UI pieces (search box with suggestions, game card, deals, favourite button, notes)
src/auth/AuthProvider.tsx    who is logged in, log in / sign up / log out
src/lib/supabase.ts          connection to Supabase
src/api/userData.ts          favourites and notes (Supabase)
supabase/schema.sql          database tables and security rules
src/api/rawg.ts              game data (through /api/rawg)
src/api/cheapshark.ts        store prices and discounts
src/styles.css               theme colours and layout
tests/                       Playwright end-to-end tests
.github/workflows/tests.yml  runs the tests on GitHub and publishes the report
playwright.config.ts         test settings (which site, browsers, reports)
allurerc.mjs                 Allure report settings
worker/index.ts              server code on Cloudflare: adds the secret RAWG key to /api/rawg requests
wrangler.jsonc               Cloudflare Worker settings
vite.config.ts               local dev server (does the Worker's job on your computer)
```

Elements that tests will use have `data-testid` attributes, so the Playwright tests won't break when the styling changes.

Game data and images come from [RAWG](https://rawg.io). Prices come from [CheapShark](https://www.cheapshark.com).
