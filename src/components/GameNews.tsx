import { useEffect, useState } from 'react';
import { getSteamAppId } from '../api/rawg';
import { getGameNews, type NewsItem } from '../api/news';
import { formatDay } from '../lib/format';
import NewsCredit from './NewsCredit';

/**
 * "Official news" on a game page: the latest posts by the game's makers on Steam (headline, date, link).
 * Hidden for games that aren't on Steam or have no posts.
 */
export default function GameNews({ gameId, onResult }: { gameId: string; onResult?: (hasNews: boolean) => void }) {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [appId, setAppId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setItems(null);
    getSteamAppId(gameId, controller.signal)
      .then((id) => {
        setAppId(id);
        return id ? getGameNews(id, controller.signal) : [];
      })
      .then(setItems)
      .catch(() => !controller.signal.aborted && setItems([]));
    return () => controller.abort();
  }, [gameId]);

  // Tell the page whether there's a box (it rearranges the other boxes around it).
  useEffect(() => {
    if (items) onResult?.(items.length > 0);
  }, [items, onResult]);

  if (!items || items.length === 0) return null;

  return (
    <aside className="panel game-news" data-testid="game-news">
      <h2>Official news</h2>
      <ul className="news-list compact">
        {items.map((n) => (
          <li key={n.url} className="news-item">
            <a href={n.url} target="_blank" rel="noreferrer" className="news-title">{n.title}</a>
            <span className="news-meta">{formatDay(new Date(n.date * 1000))}</span>
          </li>
        ))}
      </ul>
      {appId && (
        <a
          className="news-more small"
          href={`https://store.steampowered.com/news/app/${appId}`}
          target="_blank"
          rel="noreferrer"
        >
          All news on Steam ↗
        </a>
      )}
      <NewsCredit />
    </aside>
  );
}
