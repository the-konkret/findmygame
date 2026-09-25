// /api/complete?q=killz → { "words": ["killzone"] }
//
// RAWG's search only matches whole words (and forgives a small typo), so a half-typed word like
// "killz" or "cyberp" finds nothing useful. This finishes the last word you're typing, using the
// titles of real video games on Wikidata (free, public-domain data), so the app can then ask RAWG
// for "killzone". Asked from here, not from the browser, so visitors' searches aren't sent to
// another site, and each answer is kept for a day.

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface WikidataHit {
  label?: string;
  description?: string;
}

// Descriptions of games (not the album, village or rapper with the same name).
const IS_GAME = /video ?game|computer game|game series|game franchise/i;

/** "Killzone: Shadow Fall" → "killzone shadow fall" (the same idea as normalize() in src/api/rawg.ts) */
function simplify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export async function handleComplete(url: URL, ctx: ExecutionContext): Promise<Response> {
  const query = simplify(url.searchParams.get('q') ?? '').slice(0, 80);
  const last = query.split(' ').pop() ?? '';
  if (last.length < 3 || !/[a-z]/.test(last)) return reply({ words: [] });

  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  const key = new Request(`https://findmygame.cache/complete/${encodeURIComponent(query)}`);
  const cached = await cache?.match(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    action: 'wbsearchentities',
    search: query,
    language: 'en',
    uselang: 'en',
    type: 'item',
    limit: '30',
    format: 'json',
  });
  let hits: WikidataHit[] = [];
  try {
    const upstream = await fetch(`https://www.wikidata.org/w/api.php?${params}`, {
      headers: { 'User-Agent': 'FindMyGame/1.0 (+https://github.com/the-konkret/findmygame)' },
    });
    if (!upstream.ok) return reply({ words: [] }, false);
    hits = ((await upstream.json()) as { search?: WikidataHit[] }).search ?? [];
  } catch {
    return reply({ words: [] }, false);
  }

  // Wikidata lists the best-known first. From each game title, take the word that starts with what
  // you typed ("killz" → "killzone"). If some game has exactly that word already, it's a whole word
  // and RAWG can search it as it is: nothing to finish.
  const words: string[] = [];
  let alreadyWhole = false;
  for (const hit of hits) {
    if (!hit.label || !IS_GAME.test(hit.description ?? '')) continue;
    for (const word of simplify(hit.label).split(' ')) {
      if (word === last) alreadyWhole = true;
      else if (word.startsWith(last) && !words.includes(word)) words.push(word);
    }
  }

  const response = reply({ words: alreadyWhole ? [] : words.slice(0, 3) });
  if (cache) ctx.waitUntil(cache.put(key, response.clone()));
  return response;
}

function reply(body: unknown, keep = true): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': keep ? 'public, max-age=86400' : 'no-store',
    },
  });
}
