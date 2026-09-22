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

/** Search games by title. Precise search + popularity ordering puts well-known games first. */
export async function searchGames(term: string, signal?: AbortSignal): Promise<GameSummary[]> {
  const data = await request<Paged<GameSummary>>(
    '/games',
    { search: term, search_precise: 'true', ordering: '-added', page_size: '20' },
    signal,
  );
  return data.results;
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
