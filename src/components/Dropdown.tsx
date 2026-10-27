import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export interface DropdownOption {
  value: string;
  label: string;
}

/**
 * A dropdown in the site's own style (the browser's built-in list can't be styled): a button that opens a
 * scrollable list. Mouse, touch and keyboard (↑ ↓ Home End Enter Esc) all work.
 * inline: the list opens below, pushing things down, instead of floating (for the phone filter drawer).
 */
export default function Dropdown({
  label,
  value,
  options,
  onChange,
  testId,
  inline = false,
  highlightWhenSet = true,
}: {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange(value: string): void;
  testId?: string;
  inline?: boolean;
  /** orange outline when something other than the first option is chosen */
  highlightWhenSet?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const chosen = Math.max(0, options.findIndex((o) => o.value === value));
  const isSet = highlightWhenSet && chosen > 0;

  // Close on a tap / click outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // On opening, start at the chosen option and scroll it into view.
  useEffect(() => {
    if (!open) return;
    setActive(chosen);
    requestAnimationFrame(() => {
      const el = listRef.current?.children[chosen] as HTMLElement | undefined;
      el?.scrollIntoView({ block: 'nearest' });
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function pick(index: number) {
    onChange(options[index].value);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    const last = options.length - 1;
    if (e.key === 'ArrowDown') setActive((i) => Math.min(last, i + 1));
    else if (e.key === 'ArrowUp') setActive((i) => Math.max(0, i - 1));
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(last);
    else if (e.key === 'Enter' || e.key === ' ') pick(active);
    else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false);
      if (e.key === 'Tab') return;
    } else return;
    e.preventDefault();
  }

  return (
    <div className={`dropdown ${inline ? 'inline' : ''} ${open ? 'open' : ''}`} ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`dropdown-button ${isSet ? 'set' : ''}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${options[chosen]?.label ?? ''}`}
        data-testid={testId}
      >
        <span className="dropdown-value">{options[chosen]?.label}</span>
        <svg className="dropdown-arrow" width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"
          fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul className="dropdown-list" role="listbox" id={listId} ref={listRef} aria-label={label}>
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={i === chosen}
              className={`dropdown-option ${i === active ? 'active' : ''} ${i === chosen ? 'chosen' : ''}`}
              onPointerEnter={() => setActive(i)}
              onClick={() => pick(i)}
            >
              {o.label}
              {i === chosen && (
                <svg className="dropdown-check" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"
                  fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5 9-10" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
