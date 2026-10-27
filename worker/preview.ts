// Link previews for game pages. When someone pastes https://…/game/3328 into Messenger, WhatsApp,
// Discord, Slack, X…, that app downloads the page and looks for "Open Graph" tags to build a card
// (picture, title, a line of text). The site is one page that React fills in later, which those apps
// don't run, so here, on Cloudflare, we write the game's own tags into the page before sending it.
//
// The picture is the game's cover from RAWG (shown on the game page anyway); the facts are short ones
// we put together ourselves (score, rating, year, genres). Answers from RAWG are kept for a day.

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

// The parts of Cloudflare's HTMLRewriter we use (it edits a page as it streams through).
interface RewriterElement {
  remove(): void;
  setInnerContent(content: string): void;
  append(content: string, options: { html: boolean }): void;
}
declare const HTMLRewriter: {
  new (): {
    on(selector: string, handlers: { element(el: RewriterElement): void }): InstanceType<typeof HTMLRewriter>;
    transform(response: Response): Response;
  };
};

interface PreviewGame {
  name: string;
  image: string | null;
  metacritic: number | null;
  rating: number;
  released: string | null;
  genres: string[];
}

const SITE_NAME = 'FindMyGame';

/** Is this a game page address (/game/3328)? Returns the id, or null. */
export function gamePageId(pathname: string): string | null {
  const match = pathname.match(/^\/game\/(\d{1,9})\/?$/);
  return match ? match[1] : null;
}

/** The page for /game/:id with that game's preview tags; the plain page if anything goes wrong. */
export async function gamePageWithPreview(
  request: Request,
  id: string,
  env: { RAWG_API_KEY?: string; ASSETS: { fetch(request: Request): Promise<Response> } },
  ctx: ExecutionContext,
): Promise<Response> {
  const page = await env.ASSETS.fetch(request); // index.html (the site answers every page with it)
  if (!page.ok || !(page.headers.get('Content-Type') ?? '').includes('text/html')) return page;

  const game = await loadGame(id, env.RAWG_API_KEY, ctx).catch(() => null);
  if (!game) return page;

  const url = new URL(request.url);
  const title = `${game.name} – ${SITE_NAME}`;
  const description = summary(game);
  const tags = [
    meta('name', 'description', description),
    meta('property', 'og:site_name', SITE_NAME),
    meta('property', 'og:type', 'website'),
    meta('property', 'og:url', `${url.origin}/game/${id}`),
    meta('property', 'og:title', game.name),
    meta('property', 'og:description', description),
    meta('name', 'twitter:title', game.name),
    meta('name', 'twitter:description', description),
  ];
  if (game.image) {
    tags.push(
      meta('property', 'og:image', game.image),
      meta('property', 'og:image:alt', `${game.name} cover art`),
      meta('name', 'twitter:card', 'summary_large_image'),
      meta('name', 'twitter:image', game.image),
    );
  } else {
    tags.push(meta('name', 'twitter:card', 'summary'));
  }

  const out = new HTMLRewriter()
    // drop the site-wide defaults from index.html, then add this game's
    .on('meta[property^="og:"]', { element: (el) => el.remove() })
    .on('meta[name^="twitter:"]', { element: (el) => el.remove() })
    .on('meta[name="description"]', { element: (el) => el.remove() })
    .on('title', { element: (el) => el.setInnerContent(escape(title)) })
    .on('head', { element: (el) => el.append(tags.join(''), { html: true }) })
    .transform(page);

  const headers = new Headers(out.headers);
  headers.set('Cache-Control', 'public, max-age=300'); // the page now carries game facts: refresh now and then
  return new Response(out.body, { status: out.status, headers });
}

/** "Metacritic 92 · ★ 4.6/5 · 2015 · Action, RPG. Prices, deals and details on FindMyGame." */
function summary(game: PreviewGame): string {
  const facts: string[] = [];
  if (game.metacritic) facts.push(`Metacritic ${game.metacritic}`);
  if (game.rating > 0) facts.push(`★ ${game.rating.toFixed(1)}/5`);
  if (game.released) facts.push(game.released.slice(0, 4));
  if (game.genres.length) facts.push(game.genres.slice(0, 3).join(', '));
  const lead = facts.length ? `${facts.join(' · ')}. ` : '';
  return `${lead}Prices, deals and details on ${SITE_NAME}.`;
}

async function loadGame(id: string, key: string | undefined, ctx: ExecutionContext): Promise<PreviewGame | null> {
  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  const cacheKey = new Request(`https://findmygame.cache/preview/v1/${id}`);
  const hit = await cache?.match(cacheKey);
  if (hit) return (await hit.json()) as PreviewGame;
  if (!key) return null;

  const res = await fetch(`https://api.rawg.io/api/games/${id}?key=${encodeURIComponent(key)}`, {
    headers: { 'User-Agent': 'FindMyGame (+https://github.com/the-konkret/findmygame)' },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    name?: string;
    background_image?: string | null;
    metacritic?: number | null;
    rating?: number;
    released?: string | null;
    genres?: { name: string }[];
  };
  if (!data.name) return null;

  const game: PreviewGame = {
    name: data.name,
    // a smaller copy of the cover (RAWG can resize), plenty for a preview card
    image: data.background_image ? data.background_image.replace('/media/games/', '/media/resize/1280/-/games/') : null,
    metacritic: data.metacritic ?? null,
    rating: data.rating ?? 0,
    released: data.released ?? null,
    genres: (data.genres ?? []).map((g) => g.name),
  };
  if (cache) {
    const stored = new Response(JSON.stringify(game), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
    });
    ctx.waitUntil(cache.put(cacheKey, stored));
  }
  return game;
}

function meta(attr: 'name' | 'property', key: string, content: string): string {
  return `<meta ${attr}="${key}" content="${escape(content)}" />`;
}

function escape(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
