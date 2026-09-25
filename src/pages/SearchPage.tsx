import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { moreResults, startSearch, type GameSummary, type SearchResults } from '../api/rawg';
import { describeSearch, MAX_DESCRIPTION, type AiMatch } from '../api/describe';
import GameCard from '../components/GameCard';
import SearchBox from '../components/SearchBox';
import SurpriseButton from '../components/SurpriseButton';
import { CloseIcon } from '../components/Icons';
import { useFavouriteIds } from '../hooks/useFavouriteIds';

type Status = 'idle' | 'loading' | 'done' | 'error';

const PER_PAGE = 20;
type Mode = 'name' | 'describe';

export default function SearchPage() {
  // The submitted search lives in the address, so Back/Forward and shared links work:
  //   ?q=...   search by name (typing only shows suggestions; Enter fills the address and the grid)
  //   ?ai=...  "Describe it": the AI's guesses for a description
  //   &tab=ai  both kept, "Describe it" was the last one used (each tab shows only its own results,
  //            and switching back to the other tab brings its results back)
  const [params, setParams] = useSearchParams();
  const query = (params.get('q') ?? '').trim();
  const aiQuery = (params.get('ai') ?? '').trim();
  const aiTab = params.get('tab') === 'ai';
  const [mode, setMode] = useState<Mode>(aiQuery && (aiTab || !query) ? 'describe' : 'name');
  const [input, setInput] = useState(query);
  const [description, setDescription] = useState(aiQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const describeRef = useRef<HTMLTextAreaElement>(null);

  // Search by name: everything found so far, shown PER_PAGE at a time ("Load more" shows the next batch).
  const [search, setSearch] = useState<SearchResults | null>(null);
  const [shown, setShown] = useState(PER_PAGE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const moreAbort = useRef<AbortController | null>(null);
  const results = search ? search.games.slice(0, shown) : [];
  const canLoadMore = !!search && (search.games.length > shown || search.hasMore);
  const [matches, setMatches] = useState<AiMatch[]>([]);
  const [similar, setSimilar] = useState<GameSummary[]>([]);
  // name search and AI search load separately
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [aiStatus, setAiStatus] = useState<Status>('idle');
  const [aiError, setAiError] = useState('');
  const favouriteIds = useFavouriteIds(); // to put a ★ on games you've already saved

  // Results for the tab you're on (the other tab's stay hidden until you switch back)
  const hasResults = mode === 'name' ? Boolean(query) : Boolean(aiQuery);

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
    if (aiQuery && (aiTab || !query)) setMode('describe');
    else if (query) setMode('name');
    if (!query && !aiQuery) {
      window.scrollTo({ top: 0 });
      (mode === 'describe' ? describeRef : inputRef).current?.focus();
    }
  }, [query, aiQuery, aiTab]);

  // Load the results for the submitted name search.
  useEffect(() => {
    setSearch(null);
    setShown(PER_PAGE);
    setMoreError(false);
    setLoadingMore(false);
    moreAbort.current?.abort();
    if (!query) {
      setStatus('idle');
      return;
    }
    const controller = new AbortController();
    setStatus('loading');
    setError('');
    startSearch(query, controller.signal)
      .then((r) => {
        setSearch(r);
        setStatus('done');
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setError(err.message);
        setStatus('error');
      });
    return () => controller.abort();
  }, [query]);

  // Load the AI's guesses for the submitted description.
  useEffect(() => {
    setMatches([]);
    setSimilar([]);
    if (!aiQuery) {
      setAiStatus('idle');
      return;
    }
    const controller = new AbortController();
    setAiStatus('loading');
    setAiError('');
    describeSearch(aiQuery, controller.signal)
      .then((r) => {
        setMatches(r.matches);
        setSimilar(r.similar);
        setAiStatus('done');
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setAiError(err.message);
        setAiStatus('error');
      });
    return () => controller.abort();
  }, [aiQuery]);

  /** "Load more": the next PER_PAGE games, asking RAWG for another page if we've shown all we have. */
  async function loadMore() {
    if (!search || loadingMore) return;
    setMoreError(false);
    if (search.games.length >= shown + PER_PAGE || !search.hasMore) {
      setShown((n) => n + PER_PAGE);
      return;
    }
    const controller = new AbortController();
    moreAbort.current = controller;
    setLoadingMore(true);
    try {
      const next = await moreResults(search, controller.signal);
      if (controller.signal.aborted) return;
      setSearch(next);
      setShown((n) => n + PER_PAGE);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setMoreError(true);
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  }

  function submit(term: string) {
    if (term === query) return;
    // keep the last description (for the other tab); this tab is now the one in use
    setParams({ ...(term ? { q: term } : {}), ...(aiQuery ? { ai: aiQuery } : {}) });
    inputRef.current?.blur();
  }

  function submitDescription(e?: FormEvent) {
    e?.preventDefault();
    const text = description.trim().replace(/\s+/g, ' ');
    if (text.length < 5 || (text === aiQuery && aiTab)) return;
    setParams({ ...(query ? { q: query } : {}), ai: text, tab: 'ai' });
    describeRef.current?.blur();
  }

  // Enter searches; Shift+Enter starts a new line.
  function onDescribeKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) submitDescription(e);
  }

  // After the first tab switch, the boxes no longer grab the cursor by themselves when they appear;
  // switchMode below decides.
  const switchedRef = useRef(false);

  function switchMode(next: Mode) {
    if (next === mode) return;
    switchedRef.current = true;
    setMode(next);
    // Put the cursor in the new box, ready to type. Exception: back on "Search by name" with text already in
    // the box, where the cursor would pop the suggestions open again; they reopen when you click in or type.
    if (next === 'name' && input.trim().length >= 2) return;
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
              <SearchBox value={input} onChange={setInput} onSubmit={submit} inputRef={inputRef} autoFocus={!hasResults && !switchedRef.current} />
              {/* Only on the fresh home page, next to the big search box. */}
              {!hasResults && <SurpriseButton />}
            </div>
            {!hasResults && <p className="hero-hint">Start typing to see suggestions, or press Enter to see all results.</p>}
          </>
        ) : (
          <form className="describe-box" onSubmit={submitDescription} data-testid="describe-form">
            <div className="describe-field">
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
              autoFocus={!hasResults && !switchedRef.current}
            />
            {description !== '' && (
              <button
                type="button"
                className="field-clear describe-clear"
                aria-label="Clear the description"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  setDescription('');
                  describeRef.current?.focus();
                }}
                data-testid="describe-clear"
              >
                <CloseIcon size={12} />
              </button>
            )}
            </div>
            <div className="describe-bar">
              <span className="muted small">
                What happens in it, how it looks, roughly when it came out… The AI suggests up to 5 games.
              </span>
              <button
                type="submit"
                className="btn-primary"
                disabled={description.trim().length < 5 || aiStatus === 'loading'}
                data-testid="describe-submit"
              >
                {aiStatus === 'loading' ? 'Thinking…' : 'Find it'}
              </button>
            </div>
          </form>
        )}
        </div>
      </div>

      {/* Only the results of the tab you're on */}
      {(mode === 'name' ? status : aiStatus) === 'loading' && (
        <>
          {mode === 'describe' && <p className="status" data-testid="describe-loading">Asking the AI which games fit…</p>}
          <div className="grid" data-testid="search-loading" aria-busy="true" aria-label="Searching">
            {Array.from({ length: mode === 'describe' ? 5 : 8 }, (_, i) => (
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
      {mode === 'name' && status === 'error' && <p className="status error" data-testid="search-error">{error}</p>}
      {mode === 'describe' && aiStatus === 'error' && <p className="status error" data-testid="search-error">{aiError}</p>}
      {mode === 'name' && status === 'done' && query && results.length === 0 && (
        <p className="status" data-testid="search-empty">No games found for “{query}”.</p>
      )}
      {mode === 'describe' && aiStatus === 'done' && aiQuery && matches.length === 0 && similar.length === 0 && (
        <p className="status" data-testid="describe-empty">
          The AI couldn't match that to a game. Try adding details: what you do in it, the setting or look, the
          platform, or roughly when it came out.
        </p>
      )}

      {mode === 'name' && results.length > 0 && (
        <div className="grid" data-testid="search-results">
          {results.map((g) => (
            <GameCard key={g.id} game={g} isFavourite={favouriteIds?.has(g.id) ?? false} />
          ))}
          {canLoadMore && (
            <button
              type="button"
              className="card load-more-card"
              onClick={loadMore}
              disabled={loadingMore}
              aria-busy={loadingMore}
              data-testid="load-more"
            >
              <span className="load-more-plus" aria-hidden>{loadingMore ? '' : '+'}</span>
              <span className="load-more-label">{loadingMore ? 'Loading…' : 'Load more'}</span>
              {moreError && <span className="load-more-error">Couldn't load more. Tap to try again.</span>}
            </button>
          )}
        </div>
      )}

      {mode === 'describe' && matches.length > 0 && (
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

      {mode === 'describe' && similar.length > 0 && (
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
