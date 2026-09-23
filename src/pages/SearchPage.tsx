import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchGames, type GameSummary } from '../api/rawg';
import GameCard from '../components/GameCard';
import SearchBox from '../components/SearchBox';
import { useFavouriteIds } from '../hooks/useFavouriteIds';

type Status = 'idle' | 'loading' | 'done' | 'error';

export default function SearchPage() {
  // The submitted search lives in the address (?q=...), so Back/Forward and shared links work.
  // Typing only shows suggestions; Enter (or "Show all results") fills the address and the grid.
  const [params, setParams] = useSearchParams();
  const query = (params.get('q') ?? '').trim();
  const [input, setInput] = useState(query);
  const inputRef = useRef<HTMLInputElement>(null);

  const [results, setResults] = useState<GameSummary[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const favouriteIds = useFavouriteIds(); // to put a ★ on games you've already saved

  // The address changed (a search was submitted, the logo was clicked, Back/Forward): follow it.
  useEffect(() => {
    setInput(query);
    if (!query) {
      window.scrollTo({ top: 0 });
      inputRef.current?.focus();
    }
  }, [query]);

  // Load the full results for the submitted search.
  useEffect(() => {
    if (!query) {
      setResults([]);
      setStatus('idle');
      return;
    }
    const controller = new AbortController();
    setStatus('loading');
    searchGames(query, controller.signal)
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
  }, [query]);

  function submit(term: string) {
    if (term === query) return;
    setParams(term ? { q: term } : {});
    inputRef.current?.blur();
  }

  return (
    <section className="search-page">
      <div className={`search-hero ${query ? 'compact' : ''}`}>
        {!query && <h1 className="hero-title">Find your next game</h1>}
        {/* Focus the box only on a fresh home page. Coming back to results, it stays inactive so the
            suggestions don't pop open by themselves. */}
        <SearchBox value={input} onChange={setInput} onSubmit={submit} inputRef={inputRef} autoFocus={!query} />
        {!query && <p className="hero-hint">Start typing to see suggestions, or press Enter to see all results.</p>}
      </div>

      {status === 'loading' && <p className="status" data-testid="search-loading">Searching…</p>}
      {status === 'error' && <p className="status error" data-testid="search-error">{error}</p>}
      {status === 'done' && results.length === 0 && (
        <p className="status" data-testid="search-empty">No games found for “{query}”.</p>
      )}

      {results.length > 0 && (
        <div className="grid" data-testid="search-results">
          {results.map((g) => (
            <GameCard key={g.id} game={g} isFavourite={favouriteIds?.has(g.id) ?? false} />
          ))}
        </div>
      )}
    </section>
  );
}
