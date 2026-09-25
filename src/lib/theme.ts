// Light or dark look for the whole site. Dark is the default; the choice is kept in this browser.
// index.html applies a saved "light" before the page draws, so there's no dark flash on load.

export type Theme = 'dark' | 'light';

const KEY = 'fmg-theme';
const BAR_COLOURS: Record<Theme, string> = { dark: '#0b0b0c', light: '#f6f6f7' };

export function getTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function setTheme(theme: Theme): void {
  try {
    if (theme === 'light') localStorage.setItem(KEY, 'light');
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode etc.: it still changes for this visit */
  }
  applyTheme(theme);
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'light') root.dataset.theme = 'light';
  else delete root.dataset.theme;
  // the phone browser's address bar
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOURS[theme]);
}
