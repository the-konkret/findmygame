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
 * RAWG's own order is either "relevance" (which puts tiny unknown games named exactly "witcher" first)
 * or "popularity" (which puts GTA V above Portal 2 for "portal 2"). So we ask for the most popular
 * matches and re-rank them here: titles containing every word you typed come first, then popularity.
 */
export async function searchGames(term: string, signal?: AbortSignal, limit = 20): Promise<GameSummary[]> {
  const data = await request<Paged<GameSummary>>(
    '/games',
    { search: term, search_precise: 'true', ordering: '-added', page_size: '40' },
    signal,
  );
  return rankByTitleMatch(data.results, term).slice(0, limit);
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

  const score = (game: T): number => {
    const name = normalize(game.name);
    const nameWords = name.split(' ');
    const initials = nameWords.map((w) => w[0]).join(''); // "grand theft auto 5" → "gta5"
    // Every typed word starts some word of the title ("wit" matches "witcher" while you type),
    // or a single typed word is the start of the title's initials ("gta", "cod").
    const matches =
      queryWords.every((q) => nameWords.some((w) => w.startsWith(q))) ||
      (queryWords.length === 1 && query.length >= 2 && initials.startsWith(query));
    let points = 0;
    if (matches) points += 3;
    if (name.startsWith(query)) points += 1;
    if (name === query) points += 1;
    // Popularity adds up to ~5 points: 10 users → 1, 1,000 → 3, 100,000 → 5.
    points += Math.log10((game.added ?? 0) + 1);
    return points;
  };

  return games
    .map((game, index) => ({ game, index, points: score(game) }))
    .sort((a, b) => b.points - a.points || a.index - b.index)
    .map((x) => x.game);
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
