import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type RefObject } from 'react';
import { countSecretTap } from './faceRain';
import { useNavigate } from 'react-router-dom';
import { searchGames, type GameSummary } from '../api/rawg';
import { useDebounce } from '../hooks/useDebounce';
import LoadingImage from './LoadingImage';
import { SearchIcon } from './Icons';

const MAX_SUGGESTIONS = 6;

interface Props {
  value: string;
  onChange(value: string): void;
  /** Show the full results grid for this text (Enter, or "Show all results"). */
  onSubmit(term: string): void;
  inputRef: RefObject<HTMLInputElement | null>;
  /** Put the cursor in the box when the page opens (only on a fresh home page). */
  autoFocus?: boolean;
  /** Smaller version for the top bar. */
  compact?: boolean;
}

type Status = 'idle' | 'loading' | 'done' | 'error';

/**
 * The search box with a suggestions dropdown.
 * Type → the top matches appear. ↑/↓ to move, Enter to open the highlighted game
 * (or to show all results when nothing is highlighted), Esc to close.
 */
export default function SearchBox({ value, onChange, onSubmit, inputRef, autoFocus = false, compact = false }: Props) {
  const navigate = useNavigate();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<GameSummary[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [active, setActive] = useState(-1); // highlighted row; -1 = none

  const text = value.trim();
  const term = useDebounce(text, 250);
  const boxRef = useRef<HTMLDivElement>(null);

  // Close the list when you tap or click anywhere outside the search box.
  // (Not when the box merely loses focus: on iPhones, tapping ✓/Done on the keyboard does that,
  // and you still want to see the suggestions afterwards.)
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Focus moved to another control (e.g. Tab on a keyboard): close. Focus simply dropped
  // (phone keyboard dismissed, window switched): keep the list.
  function onBlur(e: FocusEvent<HTMLInputElement>) {
    const next = e.relatedTarget as Node | null;
    if (next && !boxRef.current?.contains(next)) setOpen(false);
  }

  // Fetch suggestions while the dropdown is open and the typing has paused.
  useEffect(() => {
    if (!open || term.length < 2) {
      setSuggestions([]);
      setStatus('idle');
      return;
    }
    const controller = new AbortController();
    setStatus('loading');
    searchGames(term, controller.signal, MAX_SUGGESTIONS)
      .then((games) => {
        setSuggestions(games);
        setStatus('done');
        setActive(-1);
      })
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setStatus('error');
      });
    return () => controller.abort();
  }, [term, open]);

  const showDropdown = open && text.length >= 2 && status !== 'idle';
  // Rows: the suggestions, then "Show all results".
  const rowCount = suggestions.length + 1;

  function openGame(game: GameSummary) {
    setOpen(false);
    navigate(`/game/${game.id}`);
  }

  function showAll() {
    setOpen(false);
    onSubmit(text);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!showDropdown) {
        setOpen(true);
        return;
      }
      e.preventDefault(); // keep the cursor where it is
      const step = e.key === 'ArrowDown' ? 1 : -1;
      // Wraps around: past the last row goes back to "nothing highlighted" (-1), then the first row.
      setActive((i) => {
        const next = i + step;
        if (next < -1) return rowCount - 1;
        if (next >= rowCount) return -1;
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (showDropdown && active >= 0 && active < suggestions.length) openGame(suggestions[active]);
      else showAll();
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  }

  const activeId = showDropdown && active >= 0 ? `${listId}-opt-${active}` : undefined;

  return (
    <div className={`search-box ${compact ? 'compact' : ''}`} ref={boxRef}>
      <span className="search-icon" aria-hidden onClick={countSecretTap} data-testid="search-icon">
        <SearchIcon size={compact ? 16 : 20} />
      </span>
      <input
        ref={inputRef}
        type="search"
        autoFocus={autoFocus}
        autoComplete="off"
        placeholder={compact ? 'Search games' : 'Search games, e.g. The Witcher 3'}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => text.length >= 2 && setOpen(true)}
        onBlur={onBlur}
        role="combobox"
        aria-label="Search games"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        aria-controls={listId}
        aria-activedescendant={activeId}
        data-testid="search-input"
      />

      {showDropdown && (
        <ul className="suggestions" id={listId} role="listbox" data-testid="search-suggestions">
          {status === 'loading' && suggestions.length === 0 && (
            <li className="suggestion-note" data-testid="suggestions-loading">Searching…</li>
          )}
          {status === 'error' && (
            <li className="suggestion-note error-text">Couldn't load suggestions. Press Enter to search.</li>
          )}
          {status === 'done' && suggestions.length === 0 && (
            <li className="suggestion-note" data-testid="suggestions-none">No matching games</li>
          )}

          {suggestions.map((g, i) => (
            <li
              key={g.id}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={active === i}
              className={`suggestion ${active === i ? 'active' : ''}`}
              // mousedown (not click) so it fires before the input loses focus and closes the list
              onMouseDown={(e) => {
                e.preventDefault();
                openGame(g);
              }}
              onMouseEnter={() => setActive(i)}
              data-testid="suggestion"
            >
              <Thumb src={g.background_image} />
              <span className="suggestion-name" data-testid="suggestion-title">{g.name}</span>
              <span className="suggestion-year">{g.released ? g.released.slice(0, 4) : 'TBA'}</span>
            </li>
          ))}

          <li
            id={`${listId}-opt-${suggestions.length}`}
            role="option"
            aria-selected={active === suggestions.length}
            className={`suggestion suggestion-all ${active === suggestions.length ? 'active' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              showAll();
            }}
            onMouseEnter={() => setActive(suggestions.length)}
            data-testid="suggestion-all"
          >
            Show all results for “{text}” <kbd>Enter</kbd>
          </li>
        </ul>
      )}
    </div>
  );
}

/** Small cover picture with a skeleton. Asks RAWG for a resized copy (much smaller download), falling back to the original. */
function Thumb({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!src) return <span className="suggestion-thumb" />;
  const small = src.replace('/media/games/', '/media/resize/200/-/games/');
  const useSmall = !failed && small !== src;
  return (
    <span className="suggestion-thumb">
      <LoadingImage
        src={useSmall ? small : src}
        alt=""
        loading="eager"
        fallback=""
        onError={useSmall ? () => setFailed(true) : undefined}
      />
    </span>
  );
}
