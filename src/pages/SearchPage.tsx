import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchGames, type GameSummary } from '../api/rawg';
import { describeSearch, MAX_DESCRIPTION, type AiMatch } from '../api/describe';
import GameCard from '../components/GameCard';
import SearchBox from '../components/SearchBox';
import SurpriseButton from '../components/SurpriseButton';
import { useFavouriteIds } from '../hooks/useFavouriteIds';

type Status = 'idle' | 'loading' | 'done' | 'error';
type Mode = 'name' | 'describe';

export default function SearchPage() {
  // The submitted search lives in the address, so Back/Forward and shared links work:
  //   ?q=...   search by name (typing only shows suggestions; Enter fills the address and the grid)
  //   ?ai=...  "Describe it": the AI's guesses for a description
  const [params, setParams] = useSearchParams();
  const query = (params.get('q') ?? '').trim();
  const aiQuery = (params.get('ai') ?? '').trim();
  const [mode, setMode] = useState<Mode>(aiQuery ? 'describe' : 'name');
  const [input, setInput] = useState(query);
  const [description, setDescription] = useState(aiQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const describeRef = useRef<HTMLTextAreaElement>(null);

  const [results, setResults] = useState<GameSummary[]>([]);
  const [matches, setMatches] = useState<AiMatch[]>([]);
  const [similar, setSimilar] = useState<GameSummary[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const favouriteIds = useFavouriteIds(); // to put a ★ on games you've already saved

  const hasResults = Boolean(query || aiQuery);

  // The orange pill behind the active tab slides from one tab to the other.
  const modesRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  const [pillReady, setPillReady] = useState(false); // no slide on the very first paint
  useLayoutEffect(() => {
    const measure = () => {
      const active = modesRef.current?.querySelector<HTMLElement>('.search-mode.active');
      if (active) setPill({ left: active.offsetLeft, width: active.offsetWidth });
    };
    measure();
    window.addEventListener('resize', measure);
    document.fonts?.ready.then(measure); // re-measure once the web font has loaded (text widths change)
    return () => window.removeEventListener('resize', measure);
  }, [mode]);
  useEffect(() => {
    if (!pill || pillReady) return;
    const id = requestAnimationFrame(() => setPillReady(true));
    return () => cancelAnimationFrame(id);
  }, [pill, pillReady]);

  // The address changed (a search was submitted, the logo was clicked, Back/Forward): follow it.
  useEffect(() => {
    setInput(query);
    setDescription(aiQuery);
    if (aiQuery) setMode('describe');
    else if (query) setMode('name');
    if (!query && !aiQuery) {
      window.scrollTo({ top: 0 });
      (mode === 'describe' ? describeRef : inputRef).current?.focus();
    }
  }, [query, aiQuery]);

  // Load the results for the submitted search (by name, or by description).
  useEffect(() => {
    setResults([]);
    setMatches([]);
    setSimilar([]);
    if (!query && !aiQuery) {
      setStatus('idle');
      return;
    }
    const controller = new AbortController();
    setStatus('loading');
    setError('');
    const work = aiQuery
      ? describeSearch(aiQuery, controller.signal).then((r) => {
          setMatches(r.matches);
          setSimilar(r.similar);
        })
      : searchGames(query, controller.signal).then(setResults);
    work
      .then(() => setStatus('done'))
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setError(err.message);
        setStatus('error');
      });
    return () => controller.abort();
  }, [query, aiQuery]);

  function submit(term: string) {
    if (term === query) return;
    setParams(term ? { q: term } : {});
    inputRef.current?.blur();
  }

  function submitDescription(e?: FormEvent) {
    e?.preventDefault();
    const text = description.trim().replace(/\s+/g, ' ');
    if (text.length < 5 || text === aiQuery) return;
    setParams({ ai: text });
    describeRef.current?.blur();
  }

  // Enter searches; Shift+Enter starts a new line.
  function onDescribeKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) submitDescription(e);
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setTimeout(() => (next === 'describe' ? describeRef : inputRef).current?.focus(), 0);
  }

  return (
    <section className="search-page">
      <div className={`search-hero ${hasResults ? 'compact' : ''}`}>
        {!hasResults && <h1 className="hero-title">Find your next game</h1>}

        <div className="search-modes" role="tablist" aria-label="How to search" ref={modesRef}>
          {pill && (
            <span
              className={`search-mode-pill ${pillReady ? 'animate' : ''}`}
              style={{ width: pill.width, transform: `translateX(${pill.left}px)` }}
              aria-hidden="true"
            />
          )}
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'name'}
            className={`search-mode ${mode === 'name' ? 'active' : ''}`}
            onClick={() => switchMode('name')}
            data-testid="mode-name"
          >
            Search by name
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'describe'}
            className={`search-mode ${mode === 'describe' ? 'active' : ''}`}
            onClick={() => switchMode('describe')}
            data-testid="mode-describe"
          >
            <span aria-hidden="true">✨</span> Describe it
          </button>
        </div>

        {/* key={mode}: the box is rebuilt on each switch, which replays its fade-in */}
        <div key={mode} className={`mode-panel ${pillReady ? 'animate' : ''}`}>
        {mode === 'name' ? (
          <>
            {/* Focus the box only on a fresh home page. Coming back to results, it stays inactive so the
                suggestions don't pop open by themselves. */}
            <div className="search-row">
              <SearchBox value={input} onChange={setInput} onSubmit={submit} inputRef={inputRef} autoFocus={!hasResults} />
              {/* Only on the fresh home page, next to the big search box. */}
              {!hasResults && <SurpriseButton />}
            </div>
            {!hasResults && <p className="hero-hint">Start typing to see suggestions, or press Enter to see all results.</p>}
          </>
        ) : (
          <form className="describe-box" onSubmit={submitDescription} data-testid="describe-form">
            <textarea
              ref={describeRef}
              className="describe-input"
              rows={3}
              maxLength={MAX_DESCRIPTION}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={onDescribeKey}
              placeholder="e.g. an old platformer where you're a worm in a robotic space suit"
              aria-label="Describe the game you're looking for"
              data-testid="describe-input"
              autoFocus={!hasResults}
            />
            <div className="describe-bar">
              <span className="muted small">
                What happens in it, how it looks, roughly when it came out… The AI suggests up to 5 games.
              </span>
              <button
                type="submit"
                className="btn-primary"
                disabled={description.trim().length < 5 || status === 'loading'}
                data-testid="describe-submit"
              >
                {status === 'loading' && aiQuery ? 'Thinking…' : 'Find it'}
              </button>
            </div>
          </form>
        )}
        </div>
      </div>

      {status === 'loading' && (
        <>
          {aiQuery && <p className="status" data-testid="describe-loading">Asking the AI which games fit…</p>}
          <div className="grid" data-testid="search-loading" aria-busy="true" aria-label="Searching">
            {Array.from({ length: aiQuery ? 5 : 8 }, (_, i) => (
              <div key={i} className="card card-skeleton" aria-hidden>
                <div className="card-image skeleton" />
                <div className="card-body">
                  <span className="sk-line" style={{ width: '80%' }} />
                  <span className="sk-line" style={{ width: '30%' }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {status === 'error' && <p className="status error" data-testid="search-error">{error}</p>}
      {status === 'done' && query && results.length === 0 && (
        <p className="status" data-testid="search-empty">No games found for “{query}”.</p>
      )}
      {status === 'done' && aiQuery && matches.length === 0 && similar.length === 0 && (
        <p className="status" data-testid="describe-empty">
          The AI couldn't match that to a game. Try adding details: what you do in it, the setting or look, the
          platform, or roughly when it came out.
        </p>
      )}

      {results.length > 0 && (
        <div className="grid" data-testid="search-results">
          {results.map((g) => (
            <GameCard key={g.id} game={g} isFavourite={favouriteIds?.has(g.id) ?? false} />
          ))}
        </div>
      )}

      {matches.length > 0 && (
        <>
          <h2 className="describe-heading">Best guesses</h2>
          <p className="describe-note muted small">Picked by AI, best match first. The AI can be wrong, so check the details.</p>
          <div className="grid" data-testid="describe-results">
            {matches.map((m) => (
              <GameCard key={m.game.id} game={m.game} note={m.why} isFavourite={favouriteIds?.has(m.game.id) ?? false} />
            ))}
          </div>
        </>
      )}

      {similar.length > 0 && (
        <>
          <h2 className="describe-heading">More games like that</h2>
          <div className="grid" data-testid="describe-similar">
            {similar.map((g) => (
              <GameCard key={g.id} game={g} isFavourite={favouriteIds?.has(g.id) ?? false} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
