# FindMyGame

A website for searching video games, checking discounts across PC stores, and keeping favourites and notes.
Built with React + TypeScript + Vite and hosted for free on Cloudflare Pages.

## Roadmap

- [x] Game search (RAWG)
- [x] Game summary page
- [x] Discounts across PC stores (CheapShark)
- [x] Website hosting on Cloudflare Pages, API key kept on the server
- [ ] User accounts with favourites and notes (Supabase)
- [ ] Playwright tests with an Allure report (steps and screenshots)
- [ ] GitHub Actions runs the tests on every push
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
- **Online** it's stored in Cloudflare as a secret, and `functions/api/rawg/[[path]].ts` adds it to requests.

To set up your own copy, copy `.env.example` to `.env` and add a free key from https://rawg.io/apidocs.

## Deploying (Cloudflare Pages, free)

One-time setup:

1. Sign up at https://dash.cloudflare.com (free plan).
2. **Workers & Pages → Create → Pages → Connect to Git**, then choose the `findmygame` repository.
3. Build settings: Framework preset **React (Vite)**, build command `npm run build`, output directory `dist`.
4. **Environment variables**: add `RAWG_API_KEY` with your key, as type **Secret**.
5. **Save and Deploy**. The site is published at `https://findmygame-xxx.pages.dev`.

After that, every `git push` to `main` redeploys the site automatically.

## Project layout

```
src/pages/                   Search page and Game page
src/components/              UI pieces (game card, deals panel)
src/api/rawg.ts              game data (through /api/rawg)
src/api/cheapshark.ts        store prices and discounts
src/styles.css               theme colours and layout
functions/api/rawg/[[path]].ts   server function that adds the secret RAWG key (Cloudflare)
vite.config.ts               local dev server (does the same job as the function, on your computer)
```

Elements that tests will use have `data-testid` attributes, so the Playwright tests won't break when the styling changes.

Game data and images come from [RAWG](https://rawg.io). Prices come from [CheapShark](https://www.cheapshark.com).
