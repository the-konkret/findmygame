// "Describe a game" search. The Worker (worker/describe.ts) asks Cloudflare's AI for its best guesses at
// the title; here each guess is looked up on RAWG, so only real games are shown, with the AI's reason.
import { findGameByTitle, type GameSummary } from './rawg';

export interface AiMatch {
  game: GameSummary;
  /** The AI's short reason why this game fits your description. */
  why: string;
}

interface Guess {
  title: string;
  year: number | null;
  why: string;
}

export const MAX_DESCRIPTION = 400;

export async function describeSearch(description: string, signal?: AbortSignal): Promise<AiMatch[]> {
  const res = await fetch('/api/describe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
    signal,
  }).catch((err: Error) => {
    if (err.name === 'AbortError') throw err;
    throw new Error("Couldn't reach AI search. Check your connection and try again.");
  });

  let data: { games?: Guess[]; error?: string } = {};
  try {
    data = await res.json();
  } catch {
    // e.g. the site hasn't been deployed with AI search yet
  }
  if (!res.ok) throw new Error(data.error ?? `AI search failed (${res.status}).`);

  // Look the guesses up on RAWG, all at once; drop any the AI made up, and doubles.
  const guesses = data.games ?? [];
  const found = await Promise.all(
    guesses.map((g) => findGameByTitle(g.title, g.year, signal).catch(() => null)),
  );
  const seen = new Set<number>();
  const matches: AiMatch[] = [];
  found.forEach((game, i) => {
    if (!game || seen.has(game.id)) return;
    seen.add(game.id);
    matches.push({ game, why: guesses[i].why });
  });
  return matches;
}
