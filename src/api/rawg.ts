// Client for the RAWG Video Games Database API (https://rawg.io/apidocs).
// The browser never sees the API key: it calls /api/rawg/..., and a small server function
// (worker/index.ts on Cloudflare, or the Vite proxy on your computer) adds the key.

const BASE_URL = '/api/rawg';

export interface NamedRef {
  id: number;
  name: string;
  slug: string;
}

export interface GameSummary {
  id: number;
  slug: string;
  name: string;
  released: string | null;
  background_image: string | null;
  rating: number;
  metacritic: number | null;
  /** how many RAWG users added the game: a good measure of popularity */
  added?: number;
  parent_platforms?: { platform: NamedRef }[];
  genres?: NamedRef[];
}

export interface GameDetails extends GameSummary {
  description_raw: string;
  website: string;
  background_image_additional: string | null;
  platforms?: { platform: NamedRef }[];
  developers?: NamedRef[];
  publishers?: NamedRef[];
  stores?: { store: NamedRef }[];
  esrb_rating?: NamedRef | null;
  playtime: number;
}

interface Paged<T> {
  count: number;
  results: T[];
}

async function request<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const query = new URLSearchParams(params);
  const res = await fetch(`${BASE_URL}${path}?${query}`, { signal });
  if (res.status === 401) throw new Error('RAWG rejected the API key. Check RAWG_API_KEY.');
  if (!res.ok) throw new Error(`Game data request failed (${res.status})`);
  return (await res.json()) as T;
}

/**
 * Search games by title, best matches first.
 * RAWG's two orders each go wrong on their own: "relevance" puts tiny unknown games named exactly
 * "witcher" first, and "popularity" matches ANY word you typed, so for "earthworm jim 3" its top 40
 * is Witcher 3, Dark Souls III, Far Cry 3… and no Earthworm Jim at all. So we ask for both at once,
 * merge them, and rank here: how much of what you typed is in the title first, then popularity.
 */
export async function searchGames(term: string, signal?: AbortSignal, limit = 20): Promise<GameSummary[]> {
  const ask = (extra: Record<string, string>) =>
    request<Paged<GameSummary>>('/games', { search: term, search_precise: 'true', page_size: '40', ...extra }, signal);
  const [popular, relevant] = await Promise.all([ask({ ordering: '-added' }), ask({})]);

  const seen = new Set<number>();
  const merged = [...popular.results, ...relevant.results].filter((g) => !seen.has(g.id) && seen.add(g.id));
  return rankByTitleMatch(merged, term).slice(0, limit);
}

// Roman numerals as digits, so "baldurs gate 3" finds "Baldur's Gate III". ("i" is left alone: "I Am Bread".)
const ROMAN: Record<string, string> = { ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10' };

/** "Baldur's Gate III" → "baldurs gate 3" */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[®™©]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => ROMAN[word] ?? word)
    .join(' ');
}

export function rankByTitleMatch<T extends { name: string; added?: number }>(games: T[], term: string): T[] {
  const query = normalize(term);
  const queryWords = query.split(' ').filter(Boolean);
  const typedLetters = queryWords.reduce((n, w) => n + w.length, 0);

  const judge = (game: T) => {
    const name = normalize(game.name);
    const nameWords = name.split(' ');
    const initials = nameWords.map((w) => w[0]).join(''); // "grand theft auto 5" → "gta5"
    // A typed word counts when it starts some word of the title ("wit" matches "witcher" while you type).
    const found = queryWords.filter((q) => nameWords.some((w) => w.startsWith(q)));
    // A single typed word can also be the start of the title's initials ("gta", "cod").
    const byInitials = queryWords.length === 1 && query.length >= 2 && initials.startsWith(query);
    // How much of what you typed is in the title, by letters: for "earthworm jim 3", Earthworm Jim 2
    // covers 12 of 13 letters, The Witcher 3 only 1 of 13.
    const coverage = byInitials ? 1 : typedLetters ? found.reduce((n, w) => n + w.length, 0) / typedLetters : 0;

    let points = 3 * coverage;
    if (byInitials || found.length === queryWords.length) points += 1; // every word found
    if (name.startsWith(query)) points += 1;
    if (name === query) points += 1;
    // Popularity adds up to ~5 points: 10 users → 1, 1,000 → 3, 100,000 → 5.
    points += Math.log10((game.added ?? 0) + 1);
    return { coverage, points };
  };

  const ranked = games
    .map((game, index) => ({ game, index, ...judge(game) }))
    .sort((a, b) => b.points - a.points || a.index - b.index);

  // If some titles match most of what you typed, drop the ones that only share a stray word or number
  // (no Witcher 3 when you asked for Earthworm Jim 3).
  const goodMatchExists = ranked.some((x) => x.coverage >= 0.5);
  return ranked.filter((x) => !goodMatchExists || x.coverage >= 0.5).map((x) => x.game);
}

/**
 * A random game for "Surprise me": a random pick from the ~2,000 most popular games on RAWG
 * (50 pages of 40), so the surprise is something real rather than an obscure test upload.
 */
export async function getRandomGame(signal?: AbortSignal): Promise<GameSummary> {
  const page = 1 + Math.floor(Math.random() * 50);
  const data = await request<Paged<GameSummary>>(
    '/games',
    { ordering: '-added', page_size: '40', page: String(page) },
    signal,
  );
  const withPicture = data.results.filter((g) => g.background_image);
  const pool = withPicture.length > 0 ? withPicture : data.results;
  if (pool.length === 0) throw new Error("Couldn't pick a game. Please try again.");
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getGame(id: string, signal?: AbortSignal): Promise<GameDetails> {
  return request<GameDetails>(`/games/${encodeURIComponent(id)}`, {}, signal);
}

const STEAM_STORE_ID = 1; // RAWG's ID for the Steam store

/** The game's Steam app ID (e.g. "292030" for The Witcher 3), taken from its Steam store link, or null. */
export async function getSteamAppId(id: string, signal?: AbortSignal): Promise<string | null> {
  const data = await request<Paged<{ store_id: number; url: string }>>(
    `/games/${encodeURIComponent(id)}/stores`,
    {},
    signal,
  );
  const steam = data.results.find((s) => s.store_id === STEAM_STORE_ID);
  const match = steam?.url.match(/\/app\/(\d+)/);
  return match ? match[1] : null;
}
