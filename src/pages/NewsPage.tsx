import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { findGameByTitle } from '../api/rawg';
import { getLatestNews, type NewsItem } from '../api/news';
import { timeAgo } from '../lib/format';
import NewsCredit from '../components/NewsCredit';

/** News: the latest announcements from the most-played games on Steam, newest first. */
export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setItems(null);
    getLatestNews(controller.signal)
      .then(setItems)
      .catch((e: Error) => !controller.signal.aborted && setError(e.message));
    return () => controller.abort();
  }, [attempt]);

  return (
    <section className="news-page" data-testid="news-page">
      <h1 className="page-title">News</h1>
      <p className="muted small news-intro">
        Updates, patches and announcements straight from the makers of the most-played games on Steam.
      </p>

      {error && (
        <p className="status error-text" data-testid="news-error">
          {error}{' '}
          <button type="button" className="btn-ghost" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
        </p>
      )}

      {!items && !error && (
        <ul className="news-list" aria-busy="true" aria-label="Loading news">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="news-item">
              <span className="sk-line" style={{ width: '22%' }} />
              <span className="sk-line" style={{ width: `${60 + ((i * 13) % 30)}%` }} />
            </li>
          ))}
        </ul>
      )}

      {items && (
        <ul className="news-list" data-testid="news-list">
          {items.map((n) => (
            <li key={n.url} className="news-item">
              {n.game && <GameName name={n.game} />}
              <a href={n.url} target="_blank" rel="noreferrer" className="news-title" data-testid="news-title">
                {n.title}
              </a>
              <span className="news-meta">{timeAgo(new Date(n.date * 1000))} · on Steam ↗</span>
            </li>
          ))}
        </ul>
      )}

      <NewsCredit />
    </section>
  );
}

/** The game's name: opens its page here (looked up by name), or a search if it can't be found. */
function GameName({ name }: { name: string }) {
  const navigate = useNavigate();
  const [opening, setOpening] = useState(false);

  async function open() {
    setOpening(true);
    const game = await findGameByTitle(name, null).catch(() => null);
    navigate(game ? `/game/${game.id}` : `/?q=${encodeURIComponent(name)}`);
  }

  return (
    <button type="button" className="news-game" onClick={open} disabled={opening}>
      {opening ? 'Opening…' : name}
    </button>
  );
}
