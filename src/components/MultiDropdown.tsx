import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { DropdownOption } from './Dropdown';

/**
 * Like Dropdown, but you can tick several options (checkboxes). The list stays open while you tick;
 * the first row ("Any …") clears them all. The button shows "Any …", the one choice, or "PC +2".
 * inline: the list opens below, pushing things down (for the phone filter drawer).
 */
export default function MultiDropdown({
  label,
  anyLabel,
  options,
  values,
  onChange,
  testId,
  inline = false,
}: {
  label: string;
  anyLabel: string;
  options: DropdownOption[];
  values: string[];
  onChange(values: string[]): void;
  testId?: string;
  inline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0); // 0 = "Any", then options[i - 1]
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const rows = [{ value: '', label: anyLabel }, ...options];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function toggle(index: number) {
    if (index === 0) return onChange([]);
    const value = rows[index].value;
    const next = values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
    // keep them in the list's order
    onChange(options.map((o) => o.value).filter((v) => next.includes(v)));
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        setActive(0);
        setOpen(true);
      }
      return;
    }
    const last = rows.length - 1;
    if (e.key === 'ArrowDown') setActive((i) => Math.min(last, i + 1));
    else if (e.key === 'ArrowUp') setActive((i) => Math.max(0, i - 1));
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(last);
    else if (e.key === 'Enter' || e.key === ' ') toggle(active);
    else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false);
      if (e.key === 'Tab') return;
    } else return;
    e.preventDefault();
  }

  const chosen = options.filter((o) => values.includes(o.value));
  const summary = chosen.length === 0 ? anyLabel : chosen.length === 1 ? chosen[0].label : `${chosen[0].label} +${chosen.length - 1}`;

  return (
    <div className={`dropdown multi ${inline ? 'inline' : ''} ${open ? 'open' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className={`dropdown-button ${chosen.length ? 'set' : ''}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${chosen.length ? chosen.map((c) => c.label).join(', ') : anyLabel}`}
        data-testid={testId}
      >
        <span className="dropdown-value">{summary}</span>
        <svg className="dropdown-arrow" width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"
          fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul className="dropdown-list" role="listbox" aria-multiselectable="true" id={listId} ref={listRef} aria-label={label}>
          {rows.map((r, i) => {
            const checked = i === 0 ? chosen.length === 0 : values.includes(r.value);
            return (
              <li
                key={r.value || 'any'}
                role="option"
                aria-selected={checked}
                className={`dropdown-option ${i === active ? 'active' : ''} ${checked ? 'chosen' : ''}`}
                onPointerEnter={() => setActive(i)}
                onClick={() => toggle(i)}
              >
                <span className={`check-box ${checked ? 'checked' : ''} ${i === 0 ? 'round' : ''}`} aria-hidden>
                  {checked && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5 9-10" />
                    </svg>
                  )}
                </span>
                <span className="dropdown-option-label">{r.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
