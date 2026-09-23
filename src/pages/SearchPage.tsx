import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchGames, type GameSummary } from '../api/rawg';
import { useDebounce } from '../hooks/useDebounce';
import GameCard from '../components/GameCard';

type Status = 'idle' | 'loading' | 'done' | 'error';

export default function SearchPage() {
  // The query lives in the URL (?q=...) so going "Back" from a game restores the results.
  const [params, setParams] = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const [input, setInput] = useState(urlQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebounce(input.trim(), 400);
  // Wait for a pause in typing before searching, but react to an emptied box straight away.
  const term = input.trim() === '' ? '' : debounced;

  const [results, setResults] = useState<GameSummary[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  // Keep the URL in sync with the search term.
  useEffect(() => {
    if (term !== urlQuery) setParams(term ? { q: term } : {}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  // The address changed from outside (e.g. clicking the logo, or browser Back/Forward): follow it.
  useEffect(() => {
    if (urlQuery !== term) {
      setInput(urlQuery);
      if (!urlQuery) {
        window.scrollTo({ top: 0 });
        inputRef.current?.focus();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQuery]);

  // Fetch results whenever the (debounced) term changes.
  useEffect(() => {
    if (term.length < 2) {
      setResults([]);
      setStatus('idle');
      return;
    }

    const controller = new AbortController();
    setStatus('loading');
    searchGames(term, controller.signal)
      .then((games) => {
        setResults(games);
        setStatus('done');
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setError(err.message);
        setStatus('error');
      });
    return () => controller.abort();
  }, [term]);

  return (
    <section className="search-page">
      <div className={`search-hero ${term ? 'compact' : ''}`}>
        {!term && <h1 className="hero-title">Find your next game</h1>}
        <div className="search-box">
          <span className="search-icon" aria-hidden>⌕</span>
          <input
            type="search"
            ref={inputRef}
            autoFocus
            placeholder="Search games, e.g. The Witcher 3"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="Search games"
            data-testid="search-input"
          />
        </div>
      </div>

      {status === 'loading' && <p className="status" data-testid="search-loading">Searching…</p>}
      {status === 'error' && <p className="status error" data-testid="search-error">{error}</p>}
      {status === 'done' && results.length === 0 && (
        <p className="status" data-testid="search-empty">No games found for “{term}”.</p>
      )}

      {results.length > 0 && (
        <div className="grid" data-testid="search-results">
          {results.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      )}
    </section>
  );
}
