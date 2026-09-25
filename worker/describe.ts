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

/** The AI's reading of the description as RAWG filters, for the "More games like that" list. */
export interface Filters {
  genres: string[];
  tags: string[];
}

export interface AiAnswer extends Filters {
  games: Guess[];
}

/** Google's Gemma 4 (26B): on Cloudflare's free plan, good general knowledge, cheap per request. */
export const MODEL = '@cf/google/gemma-4-26b-a4b-it';
/** A smaller, simpler model to try if Gemma's answer is empty or unreadable. */
export const BACKUP_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8';

/** RAWG's genres (their exact names in RAWG's system). */
export const GENRES = [
  'action', 'indie', 'adventure', 'role-playing-games-rpg', 'strategy', 'shooter', 'casual', 'simulation',
  'puzzle', 'arcade', 'platformer', 'racing', 'massively-multiplayer', 'sports', 'fighting', 'family',
  'board-games', 'educational', 'card',
];

const MIN_LENGTH = 5;
export const MAX_LENGTH = 400;
const MAX_GUESSES = 5;

const SYSTEM_PROMPT = `You help players find video games from a description, which may be precise or very vague.
Reply with JSON only, no other text, in exactly this shape:
{"games":[{"title":"Need for Speed: Most Wanted","year":2005,"why":"Street racing while escaping the police."}],"genres":["racing"],"tags":["police","open-world"]}
Fill in:
- "games": ALWAYS exactly ${MAX_GUESSES} real, released games. If the description points to one specific game, put it first.
  If it is vague, pick the best-known, highest-rated games that fit. Official titles as stores list them; main games,
  not DLC or special editions. "year" = first release year or null. "why" = at most 15 words about the player's description.
- "genres": 1 or 2 of exactly these: ${GENRES.join(', ')}.
- "tags": 1 to 3 short lowercase tags a game store would use for this description, words joined by hyphens,
  e.g. police, cars, dragons, farming, space, zombies, horror, open-world, city-builder, stealth, survival, pixel-graphics.
Only if the text is clearly not about video games, reply {"games":[],"genres":[],"tags":[]}.
Answer right away with the JSON; do not explain.`;

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

/** Reads the model's JSON (tolerating extra text or ``` fences around it) into clean guesses and filters. */
export function parseAnswer(text: string): AiAnswer {
  const empty: AiAnswer = { games: [], genres: [], tags: [] };
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return empty;
  let data: { games?: unknown; genres?: unknown; tags?: unknown };
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    return empty;
  }

  const games: Guess[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(data?.games) ? data.games : []) {
    const g = item as { title?: unknown; year?: unknown; why?: unknown };
    const title = typeof g.title === 'string' ? g.title.trim().slice(0, 120) : '';
    if (!title || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    const year = Number(g.year);
    games.push({
      title,
      year: Number.isInteger(year) && year > 1950 && year < 2100 ? year : null,
      why: typeof g.why === 'string' ? g.why.trim().slice(0, 200) : '',
    });
    if (games.length >= MAX_GUESSES) break;
  }

  const words = (v: unknown) => (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string');
  const genres = [...new Set(words(data?.genres).map((g) => g.trim().toLowerCase()))].filter((g) => GENRES.includes(g)).slice(0, 2);
  const tags = [
    ...new Set(
      words(data?.tags).map((t) => t.trim().toLowerCase().replace(/[\s_]+/g, '-')).filter((t) => /^[a-z0-9-]{2,30}$/.test(t)),
    ),
  ].slice(0, 3);

  return { games, genres, tags };
}

/** Just the title guesses (kept for simple callers). */
export function parseGuesses(text: string): Guess[] {
  return parseAnswer(text).games;
}

async function askModel(ai: AiBinding, model: string, description: string): Promise<{ answer: AiAnswer; text: string }> {
  const result = await ai.run(model, {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: description },
    ],
    max_tokens: 1200,
    max_completion_tokens: 1200,
    temperature: 0.3,
    // Gemma 4 "thinks" before answering; for this job that only costs time and can use up the whole
    // answer budget before any JSON is written. Ask for no thinking (models that don't know these ignore them).
    reasoning_effort: 'low',
    chat_template_kwargs: { enable_thinking: false },
  });
  const text = replyText(result);
  return { answer: parseAnswer(text), text };
}

/** Asks Gemma; if its answer is empty or unreadable, asks the backup model. */
export async function askAi(ai: AiBinding, description: string): Promise<AiAnswer & { debug?: string }> {
  let first: { answer: AiAnswer; text: string } | null = null;
  let firstError = '';
  try {
    first = await askModel(ai, MODEL, description);
    if (first.answer.games.length > 0 || first.answer.tags.length > 0) return first.answer;
  } catch (err) {
    firstError = (err as Error).message ?? '';
    if (/neuron|quota|allocation/i.test(firstError)) throw err; // out of free allowance: the backup would fail too
  }
  const second = await askModel(ai, BACKUP_MODEL, description);
  if (second.answer.games.length > 0 || second.answer.tags.length > 0) return second.answer;

  // Both came back empty: say what they said, to see why (also shown in Cloudflare → Worker → Logs).
  const debug = `Gemma: ${firstError || first?.text.slice(0, 300) || '(nothing)'} | Llama: ${second.text.slice(0, 300) || '(nothing)'}`;
  console.log('AI search: no games for', JSON.stringify(description), '→', debug);
  return { ...second.answer, debug };
}

/** Title guesses only (older name, kept for the tests). */
export async function guessGames(ai: AiBinding, description: string): Promise<Guess[]> {
  return (await askAi(ai, description)).games;
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

  let answer: AiAnswer & { debug?: string };
  try {
    answer = await askAi(env.AI, clean);
  } catch (err) {
    const message = (err as Error).message ?? '';
    // Workers AI says so when the free daily allowance is used up.
    if (/neuron|limit|quota|capacity|429/i.test(message)) {
      return json({ error: 'AI search has reached its free limit for today. Please try again tomorrow.' }, 503);
    }
    console.error('AI search failed:', message);
    return json({ error: 'AI search is having trouble right now. Please try again in a moment.' }, 502);
  }

  const response = new Response(JSON.stringify(answer), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${CACHE_SECONDS}` },
  });
  if (cache && answer.games.length > 0) await cache.put(cacheKey, response.clone());
  return response;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
