# FindMyGame

A desktop app (Electron + React + TypeScript) for searching video games, checking discounts, and keeping favourites and notes.

## Roadmap

- [x] Step 2: app window, dark/orange theme, game search (RAWG)
- [x] Step 3: game summary page
- [ ] Step 4: discounts across PC stores (CheapShark)
- [ ] Step 5: local database with favourites and notes
- [ ] Step 6: Playwright tests with an Allure report (steps and screenshots)
- [ ] Step 7: GitHub Actions runs the tests on every push
- [ ] Later: mobile (Capacitor)

## Run it (Windows)

Requirements: Node.js LTS and Git.

```powershell
cd findmygame
npm install        # first time only (downloads Electron, ~100 MB)
npm run dev        # opens the desktop app with live reload
```

Other commands:

| Command | What it does |
|---|---|
| `npm run web` | Runs the UI in your browser at http://127.0.0.1:5173 (handy for debugging) |
| `npm start` | Builds the production version and opens it in Electron |
| `npm run typecheck` | Checks the TypeScript code for errors |

## API key

The RAWG key is stored in `.env`, and `.gitignore` keeps that file off GitHub.
Anyone cloning the repo copies `.env.example` to `.env` and adds their own key from https://rawg.io/apidocs.

## Project layout

```
electron/main.cjs      desktop window (Electron main process)
electron/preload.cjs   bridge between desktop and UI (the database goes here in Step 5)
src/api/rawg.ts        RAWG API client
src/pages/             Search page and Game page
src/components/        UI pieces (game card)
src/styles.css         theme colours and layout
```

Elements that tests will use have `data-testid` attributes, so the Playwright tests in Step 6 won't break when the styling changes.

Game data and images come from [RAWG](https://rawg.io).
