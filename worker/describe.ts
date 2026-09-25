// "Describe a game" search: POST /api/describe with { "description": "..." }.
// Cloudflare's own AI (Workers AI, free daily allowance) turns the description into its best guesses at
// the title; the browser then looks each guess up on RAWG, so only real games are shown.

export interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

export interface Guess {
  title: string;
  year: number | null;
  why: string;
}

/** Google's Gemma 4 (26B): on Cloudflare's free plan, good general knowledge, cheap per request. */
export const MODEL = '@cf/google/gemma-4-26b-a4b-it';

const MIN_LENGTH = 5;
export const MAX_LENGTH = 400;
const MAX_GUESSES = 5;

const SYSTEM_PROMPT = `You identify video games from a player's description.
Reply with JSON only, no other text, in exactly this shape:
{"games":[{"title":"Official English title","year":1994,"why":"One short sentence on why it matches."}]}
Rules:
- Up to ${MAX_GUESSES} real, released games, best match first. Fewer is fine if you're unsure.
- Use each game's official title as stores list it (no subtitles you're unsure of).
- "year" is the first release year, or null if unknown.
- "why" is at most 20 words and speaks to the player's description.
- If the text doesn't describe a video game, reply {"games":[]}.`;

// ---- Asking the AI ----

/** Pulls the answer text out of whatever shape the model's reply comes in. */
export function replyText(result: unknown): string {
  if (typeof result === 'string') return result;
  const r = result as {
    response?: unknown;
    choices?: { message?: { content?: unknown } }[];
  };
  if (typeof r?.response === 'string') return r.response;
  if (r?.response && typeof r.response === 'object') return JSON.stringify(r.response);
  const content = r?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  return '';
}

/** Reads the model's JSON (tolerating extra text or ``` fences around it) into clean guesses. */
export function parseGuesses(text: string): Guess[] {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return [];
  let data: unknown;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  const list = (data as { games?: unknown })?.games;
  if (!Array.isArray(list)) return [];

  const seen = new Set<string>();
  const guesses: Guess[] = [];
  for (const item of list) {
    const g = item as { title?: unknown; year?: unknown; why?: unknown };
    const title = typeof g.title === 'string' ? g.title.trim().slice(0, 120) : '';
    if (!title || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    const year = Number(g.year);
    guesses.push({
      title,
      year: Number.isInteger(year) && year > 1950 && year < 2100 ? year : null,
      why: typeof g.why === 'string' ? g.why.trim().slice(0, 200) : '',
    });
    if (guesses.length >= MAX_GUESSES) break;
  }
  return guesses;
}

export async function guessGames(ai: AiBinding, description: string): Promise<Guess[]> {
  const result = await ai.run(MODEL, {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: description },
    ],
    max_tokens: 500,
    temperature: 0.2,
  });
  return parseGuesses(replyText(result));
}

// ---- Keeping it within the free allowance ----

/** At most this many AI searches per visitor per hour (best effort: counted per Cloudflare server). */
const PER_HOUR = 20;
const recent = new Map<string, number[]>();

export function allowRequest(visitor: string, now = Date.now()): boolean {
  const hourAgo = now - 60 * 60 * 1000;
  const times = (recent.get(visitor) ?? []).filter((t) => t > hourAgo);
  if (times.length >= PER_HOUR) {
    recent.set(visitor, times);
    return false;
  }
  times.push(now);
  recent.set(visitor, times);
  if (recent.size > 5000) recent.clear(); // don't let memory grow forever
  return true;
}

/** "An  OLD game…" and "an old game" count as the same question (for the cache). */
export function normalizeDescription(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

// ---- The endpoint ----

interface DescribeEnv {
  AI?: AiBinding;
}

const CACHE_SECONDS = 24 * 60 * 60;

export async function handleDescribe(request: Request, env: DescribeEnv): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!env.AI) return json({ error: 'AI search is not set up on the server (missing "ai" in wrangler.jsonc).' }, 500);

  let description = '';
  try {
    const body = (await request.json()) as { description?: unknown };
    description = typeof body.description === 'string' ? body.description : '';
  } catch {
    return json({ error: 'Send JSON like {"description": "..."}' }, 400);
  }
  const clean = normalizeDescription(description);
  if (clean.length < MIN_LENGTH) return json({ error: 'Describe the game in a few more words.' }, 400);
  if (clean.length > MAX_LENGTH) return json({ error: `Please keep it under ${MAX_LENGTH} characters.` }, 400);

  // The same description asked again (by anyone) is answered from Cloudflare's cache, for free.
  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  const cacheKey = new Request(`https://findmygame.cache/describe?q=${encodeURIComponent(clean)}`);
  const cached = await cache?.match(cacheKey);
  if (cached) return cached;

  const visitor = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (!allowRequest(visitor)) {
    return json({ error: "You've used AI search a lot in the last hour. Please try again a bit later." }, 429);
  }

  let games: Guess[];
  try {
    games = await guessGames(env.AI, clean);
  } catch (err) {
    const message = (err as Error).message ?? '';
    // Workers AI says so when the free daily allowance is used up.
    if (/neuron|limit|quota|capacity|429/i.test(message)) {
      return json({ error: 'AI search has reached its free limit for today. Please try again tomorrow.' }, 503);
    }
    console.error('AI search failed:', message);
    return json({ error: 'AI search is having trouble right now. Please try again in a moment.' }, 502);
  }

  const response = new Response(JSON.stringify({ games }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${CACHE_SECONDS}` },
  });
  if (cache && games.length > 0) await cache.put(cacheKey, response.clone());
  return response;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
