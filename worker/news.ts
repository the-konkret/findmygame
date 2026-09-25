// Game news, the safe way: only the games' OWN announcements (what the developers and publishers
// post on their Steam pages), from Valve's official, public Steam Web API.
//   - We keep just the headline, date and link: no article text, no pictures. Reading it means going
//     to the post on Steam.
//   - No news websites are involved, so no press articles are copied or shown.
//   - Valve's API terms: credit Valve with a link (done on the pages), don't suggest Valve endorses us,
//     stay under 100,000 calls a day (answers are kept for an hour, so we use a tiny fraction).
//
// /api/steamnews?appid=292030 → the latest announcements for one game (the game page)
// /api/news                  → the latest announcements from the most-played Steam games (News page)

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

export interface NewsItem {
  title: string;
  url: string;
  /** seconds since 1970 */
  date: number;
  appId: number;
  game?: string;
}

interface SteamNewsItem {
  title?: string;
  url?: string;
  date?: number;
  appid?: number;
  feedname?: string;
}

export interface TopGame {
  appid: number;
  name: string;
  ccu: number;
}

const HOUR = 3600;
const USER_AGENT = 'FindMyGame/1.0 (+https://github.com/the-konkret/findmygame)';

/** A game's latest official announcements: headline, link, date only. */
async function announcements(appId: number, count: number): Promise<NewsItem[]> {
  const params = new URLSearchParams({
    appid: String(appId),
    count: String(count),
    maxlength: '1', // we don't show the text, so don't even fetch it
    feeds: 'steam_community_announcements', // the game makers' own posts, not press articles
    format: 'json',
  });
  const res = await fetch(`https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`Steam answered ${res.status}`);
  const data = (await res.json()) as { appnews?: { newsitems?: SteamNewsItem[] } };
  return (data.appnews?.newsitems ?? [])
    .filter((n) => n.feedname === 'steam_community_announcements' && n.title && n.url && n.date)
    .map((n) => ({ title: n.title!.trim(), url: n.url!.replace(/^http:/, 'https:'), date: n.date!, appId }));
}

function cacheStore(): Cache | undefined {
  return (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
}

function reply(body: unknown, maxAge: number): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': maxAge ? `public, max-age=${maxAge}` : 'no-store',
    },
  });
}

async function cached(key: string, ctx: ExecutionContext, make: () => Promise<unknown>): Promise<Response> {
  const cache = cacheStore();
  const request = new Request(`https://findmygame.cache/${key}`);
  const hit = await cache?.match(request);
  if (hit) return hit;
  let body: unknown;
  try {
    body = await make();
  } catch (e) {
    return reply({ error: `Couldn't reach Steam (${(e as Error).message}). Try again later.` }, 0);
  }
  const response = reply(body, HOUR);
  if (cache) ctx.waitUntil(cache.put(request, response.clone()));
  return response;
}

export function handleGameNews(url: URL, ctx: ExecutionContext): Promise<Response> | Response {
  const appId = Number(url.searchParams.get('appid'));
  if (!Number.isInteger(appId) || appId <= 0) return reply({ error: 'Missing appid' }, 0);
  return cached(`steamnews/${appId}`, ctx, async () => ({ items: await announcements(appId, 5) }));
}

/** Latest announcements from the 30 most-played games (SteamSpy list), newest first. */
export function handleNews(ctx: ExecutionContext, topGames: () => Promise<TopGame[]>): Promise<Response> {
  return cached('news/v1', ctx, async () => {
    const games = (await topGames()).sort((a, b) => b.ccu - a.ccu).slice(0, 30);
    const monthAgo = Date.now() / 1000 - 30 * 24 * HOUR;
    const lists = await Promise.all(
      games.map((g) =>
        announcements(g.appid, 3)
          .then((items) => items.map((n) => ({ ...n, game: g.name })))
          .catch(() => [] as NewsItem[]),
      ),
    );
    const items = lists
      .flat()
      .filter((n) => n.date >= monthAgo)
      .sort((a, b) => b.date - a.date)
      .slice(0, 60);
    if (items.length === 0) throw new Error('no news came back');
    return { items };
  });
}
