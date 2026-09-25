// "Describe a game" search. The Worker (worker/describe.ts) asks Cloudflare's AI for its best guesses at
// the title, plus RAWG genres and tags that fit the description. Here each guess is looked up on RAWG (so
// only real games are shown, with the AI's reason), and the genres/tags bring "More games like that".
import { discoverGames, findGameByTitle, type GameSummary } from './rawg';

export interface AiMatch {
  game: GameSummary;
  /** The AI's short reason why this game fits your description. */
  why: string;
}

export interface DescribeResult {
  /** The AI's named guesses that exist on RAWG, best first. */
  matches: AiMatch[];
  /** Popular games in the genres/tags the AI picked, not already in `matches`. */
  similar: GameSummary[];
}

interface Answer {
  games?: { title: string; year: number | null; why: string }[];
  genres?: string[];
  tags?: string[];
  error?: string;
  debug?: string;
}

export const MAX_DESCRIPTION = 400;

export async function describeSearch(description: string, signal?: AbortSignal): Promise<DescribeResult> {
  const res = await fetch('/api/describe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
    signal,
  }).catch((err: Error) => {
    if (err.name === 'AbortError') throw err;
    throw new Error("Couldn't reach AI search. Check your connection and try again.");
  });

  let data: Answer = {};
  try {
    data = await res.json();
  } catch {
    // e.g. the site hasn't been deployed with AI search yet
  }
  if (!res.ok) throw new Error(data.error ?? `AI search failed (${res.status}).`);
  if (data.debug) console.info('AI search came back empty:', data.debug);

  const guesses = data.games ?? [];
  // First find the named guesses on RAWG (made-up titles and doubles are dropped)…
  const found = await Promise.all(guesses.map((g) => findGameByTitle(g.title, g.year, signal).catch(() => null)));
  const seen = new Set<number>();
  const matches: AiMatch[] = [];
  found.forEach((game, i) => {
    if (!game || seen.has(game.id)) return;
    seen.add(game.id);
    matches.push({ game, why: guesses[i].why });
  });

  // …then "More games like that": the top guess's series, and games with the AI's tags.
  const similarAll = await discoverGames(
    { genres: data.genres ?? [], tags: data.tags ?? [] },
    { seriesOf: matches[0]?.game.id, signal },
  ).catch(() => [] as GameSummary[]);
  const similar = similarAll.filter((g) => !seen.has(g.id));
  return { matches, similar };
}
