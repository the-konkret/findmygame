# FindMyGame

A website for searching video games, checking discounts across PC stores, and keeping favourites and notes.
Built with React + TypeScript + Vite and hosted for free on Cloudflare Workers.

## Roadmap

- [x] Game search (RAWG)
- [x] Game summary page
- [x] Discounts across PC stores (CheapShark)
- [x] Website hosting on Cloudflare Workers, API key kept on the server
- [x] User accounts with favourites and notes (Supabase)
- [ ] Playwright tests with an Allure report (removed for now, to be rewritten)
- [ ] GitHub Actions runs the tests on every push (removed for now)
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

The tests and the GitHub Actions workflow were removed for now; new ones will be written once the app is more or less finished.
The tools are still set up (`playwright.config.ts`, `allurerc.mjs`, the `test` and `report` scripts), and the old tests
can be looked up in the Git history (the commit before "Remove tests for now").

## Accounts, favourites and notes (Supabase, free)

Logins, favourites and notes are stored in Supabase (a free hosted Postgres database with sign-in built in).

One-time setup:

1. In Supabase, open **SQL Editor → New query**, paste all of `supabase/schema.sql`, and click **Run**.
   This creates the `favourites` and `notes` tables and the security rules (each person sees only their own data).
2. **Authentication → Sign In / Providers → Email**: turn off **Confirm email**. The free plan can only send a few emails an hour,
   and the automated tests need to create accounts. Turn it back on later with your own email sender if you want.
3. **Authentication → URL Configuration**: set **Site URL** to the live address, and add `http://127.0.0.1:5173/**` under **Redirect URLs**.
4. Put the project URL and publishable key in `src/lib/supabase.ts`. Both are public by design; the database rules protect the data.
5. For profile pictures: run `supabase/avatars.sql` the same way. It creates the `avatars` storage bucket
   (public pictures, 200 KB limit, JPG/PNG/WebP only) and rules so each person can only change their own picture.
   The site accepts pictures up to 1 MB, crops them to a square and shrinks them to 256×256 (~20–40 KB) before uploading.
6. For the wishlist: run `supabase/wishlist.sql` the same way. It creates the `wishlist` table with the same rules as favourites.

Free-plan note: Supabase pauses a project after 7 days without activity. (The scheduled test run used to keep it awake; that has been removed for now.)

## Deploying (Cloudflare Workers, free)

The site runs as a Cloudflare Worker: `dist/` is served as static files, and `worker/index.ts` handles `/api/rawg/...`.
Settings live in `wrangler.jsonc`.

One-time setup in the Cloudflare dashboard (**Workers & Pages** → the `findmygame` Worker):

1. **Settings → Build**: build command `npm run build`, deploy command `npx wrangler deploy`.
2. **Settings → Variables and Secrets**: add `RAWG_API_KEY` with type **Secret**. Secrets are kept across deploys.
3. The Worker name must match `"name"` in `wrangler.jsonc` (`findmygame`).

After that, every `git push` to `main` rebuilds and redeploys the site. Its address is `https://findmygame.<your-subdomain>.workers.dev`.

## Price alerts and the notification bell

On a game page (Deals box), logged-in users can set "Notify me when the price drops" with their own price.
While FindMyGame is open, the app checks prices (on opening, every 30 minutes, and when you come back to the tab);
when a game reaches your price, it appears under the bell in the top bar, with today's price.
There are no emails and nothing runs on the server: notifications appear the next time you open the site.

One-time setup: run `supabase/price-alerts.sql` in the Supabase SQL Editor.

## "Describe it": AI search

On the home page, "Describe it" lets you describe a game in your own words. The Worker (`worker/describe.ts`)
asks Cloudflare Workers AI (model: Google Gemma 4) for up to 5 guesses; the browser looks each one up on RAWG and
shows only games that exist, with the AI's one-line reason.

- Free: Workers AI's free plan includes 10,000 "neurons" a day; one search uses roughly 10, so ~800 searches a day.
- Same description asked again → answered from Cloudflare's cache (free). Max 20 AI searches per visitor per hour.
- Setup: nothing to sign up for. The `"ai"` line in `wrangler.jsonc` connects it on the next deploy.
- On your computer, `npm run dev` sends AI searches to the live site (the AI only runs on Cloudflare),
  so it works locally once the AI search has been pushed.

## Project layout

```
src/pages/                   Search, Game, Login and Favourites pages
src/components/              UI pieces (search box with suggestions, game card, deals, favourite button, notes)
src/auth/AuthProvider.tsx    who is logged in, log in / sign up / log out
src/lib/supabase.ts          connection to Supabase
src/api/userData.ts          favourites and notes (Supabase)
src/api/avatar.ts            profile pictures (Supabase Storage)
src/pages/AccountPage.tsx    account page: picture, email, log out
supabase/avatars.sql         storage bucket and rules for profile pictures
supabase/wishlist.sql        wishlist table and rules
src/pages/GameListPage.tsx   shared page for My favourites and Wishlist
supabase/schema.sql          database tables and security rules
src/api/rawg.ts              game data (through /api/rawg)
src/api/cheapshark.ts        store prices and discounts
src/api/priceAlerts.ts       price alerts and the price check (Supabase + CheapShark)
src/hooks/useNotifications.ts   the bell's notifications: checks prices every 30 min while the site is open
src/components/NotificationBell.tsx   the bell and its dropdown
src/components/PriceAlertBox.tsx      "Notify me when the price drops", in the Deals box
supabase/price-alerts.sql    price alerts table and rules
public/favicon.svg           tab icon (plus favicon-32.png and apple-touch-icon.png)
worker/describe.ts           "Describe it" AI search (Cloudflare Workers AI)
src/api/describe.ts          AI search in the browser: asks the Worker, then finds each guess on RAWG
src/styles.css               theme colours and layout
playwright.config.ts         test settings (which site, browsers, reports)
allurerc.mjs                 Allure report settings
worker/index.ts              server code on Cloudflare: adds the secret RAWG key to /api/rawg requests
wrangler.jsonc               Cloudflare Worker settings
vite.config.ts               local dev server (does the Worker's job on your computer)
```

Elements that tests will use have `data-testid` attributes, so the Playwright tests won't break when the styling changes.

Game data and images come from [RAWG](https://rawg.io). Prices come from [CheapShark](https://www.cheapshark.com).
