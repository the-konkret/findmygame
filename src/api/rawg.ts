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
export function normalize(text: string): string {
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
 * The RAWG game that best matches an exact title (and year, if known), or null if nothing matches well.
 * Used by the AI search to turn the AI's guesses into real games. One request, most relevant first.
 */
export async function findGameByTitle(title: string, year: number | null, signal?: AbortSignal): Promise<GameSummary | null> {
  const data = await request<Paged<GameSummary>>(
    '/games',
    { search: title, search_precise: 'true', page_size: '10' },
    signal,
  );
  const wanted = normalize(title);
  const wantedWords = wanted.split(' ').filter(Boolean);
  if (wantedWords.length === 0) return null;

  let best: { game: GameSummary; points: number } | null = null;
  for (const game of data.results) {
    const name = normalize(game.name);
    const nameWords = name.split(' ');
    const found = wantedWords.filter((w) => nameWords.includes(w)).length / wantedWords.length;
    if (found < 0.75) continue; // not the same game
    let points = found * 3;
    if (name === wanted) points += 2;
    points -= Math.max(0, nameWords.length - wantedWords.length) * 0.15; // "Portal 2: In Motion" is not "Portal 2"
    const released = game.released ? Number(game.released.slice(0, 4)) : null;
    if (year && released) points += released === year ? 1.5 : Math.abs(released - year) <= 1 ? 0.8 : 0;
    points += Math.log10((game.added ?? 0) + 1) * 0.3; // the well-known one, not a fan remake
    if (!best || points > best.points) best = { game, points };
  }
  return best?.game ?? null;
}

interface TaggedGame extends GameSummary {
  tags?: { slug: string }[];
}

/**
 * "More games like that" for the AI search:
 *  1. the rest of the series of the AI's top guess (e.g. every Worms game), then
 *  2. popular games in the main genre carrying the AI's tags, scored so SPECIFIC tags count most:
 *     a tag only 12 games have ("worms") says far more than one thousands have ("turn-based").
 *     Games that only share a broad tag are dropped. No "anything in the genre" filler.
 */
export async function discoverGames(
  filters: { genres: string[]; tags: string[] },
  options: { seriesOf?: number; signal?: AbortSignal; limit?: number } = {},
): Promise<GameSummary[]> {
  const { seriesOf, signal, limit = 12 } = options;
  // Only the main genre: RAWG treats "racing,action" as racing OR action, which lets in unrelated games.
  const genre = filters.genres[0] ?? '';

  const [series, ...byTag] = await Promise.all([
    seriesOf
      ? request<Paged<GameSummary>>(`/games/${seriesOf}/game-series`, { page_size: '12' }, signal).catch(() => null)
      : Promise.resolve(null),
    ...filters.tags.map((tag) =>
      request<Paged<TaggedGame>>(
        '/games',
        { ordering: '-added', page_size: '20', tags: tag, ...(genre ? { genres: genre } : {}) },
        signal,
      )
        .then((data) => ({ tag, data }))
        .catch(() => null),
    ),
  ]);

  // How much each tag is worth: rarer = more telling. A tag RAWG doesn't know is ignored by RAWG
  // (it returns everything, tens of thousands), so it's worth nothing.
  const weight = new Map<string, number>();
  for (const r of byTag) {
    if (!r || r.data.count === 0 || r.data.count > 30000) continue;
    weight.set(r.tag, 1 / Math.log10(r.data.count + 10));
  }

  const scored = new Map<number, { game: GameSummary; points: number }>();
  for (const r of byTag) {
    if (!r || !weight.has(r.tag)) continue;
    for (const g of r.data.results) {
      if ((g.added ?? 0) < 20) continue; // skip obscure uploads almost nobody has added
      if (scored.has(g.id)) continue;
      const own = new Set((g.tags ?? []).map((t) => t.slug));
      own.add(r.tag); // it came back for this tag, so it has it
      let points = 0;
      for (const [tag, w] of weight) if (own.has(tag)) points += w;
      points += Math.log10((g.added ?? 0) + 1) * 0.04; // a little nudge for well-known games
      scored.set(g.id, { game: g, points });
    }
  }
  const ranked = [...scored.values()].sort((a, b) => b.points - a.points);
  const best = ranked[0]?.points ?? 0;
  const byTags = ranked.filter((x) => x.points >= best * 0.6).map((x) => x.game);

  const result = new Map<number, GameSummary>();
  for (const g of series?.results ?? []) if ((g.added ?? 0) >= 5) result.set(g.id, g);
  for (const g of byTags) if (!result.has(g.id)) result.set(g.id, g);
  return [...result.values()].slice(0, limit);
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
