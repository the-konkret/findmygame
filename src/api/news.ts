// Game news: the games' own announcements (developers' and publishers' posts on Steam), from Valve's
// official Steam Web API through our Worker (worker/news.ts). Headline, date and link only.

export interface NewsItem {
  title: string;
  url: string;
  /** seconds since 1970 */
  date: number;
  appId: number;
  /** the game's name (News page only) */
  game?: string;
}

async function load(path: string, signal?: AbortSignal): Promise<NewsItem[]> {
  const res = await fetch(path, { signal });
  const data = (await res.json().catch(() => ({}))) as { items?: NewsItem[]; error?: string };
  if (!res.ok || !data.items) throw new Error(data.error ?? `Couldn't load the news (${res.status}). Try again later.`);
  return data.items;
}

/** The latest announcements from the most-played Steam games, newest first. */
export function getLatestNews(signal?: AbortSignal): Promise<NewsItem[]> {
  return load('/api/news', signal);
}

/** One game's latest announcements (up to 5). */
export function getGameNews(steamAppId: string, signal?: AbortSignal): Promise<NewsItem[]> {
  return load(`/api/steamnews?appid=${encodeURIComponent(steamAppId)}`, signal);
}
