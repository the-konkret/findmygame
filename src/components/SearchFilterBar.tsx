import { useEffect, useState } from 'react';
import { GENRE_FILTERS, PLATFORM_FILTERS, SORT_OPTIONS, type SearchFilters, type SearchSort } from '../api/rawg';
import Dropdown, { type DropdownOption } from './Dropdown';
import MultiDropdown from './MultiDropdown';
import { CloseIcon } from './Icons';

// Release years to choose from: next year (upcoming games) back to 1980.
const NOW = new Date().getFullYear();
const YEARS = Array.from({ length: NOW + 1 - 1980 + 1 }, (_, i) => String(NOW + 1 - i));

const PLATFORMS: DropdownOption[] = PLATFORM_FILTERS.map((p) => ({ value: p.key, label: p.label }));
const GENRES: DropdownOption[] = GENRE_FILTERS.map((g) => ({ value: g.key, label: g.label }));
const YEAR_OPTIONS: DropdownOption[] = YEARS.map((y) => ({ value: y, label: y }));
const SORTS: DropdownOption[] = SORT_OPTIONS.map((o) => ({ value: o.key, label: o.label }));

interface Props {
  filters: SearchFilters;
  onChange(next: SearchFilters): void;
}

type ListKey = 'platforms' | 'genres' | 'years';
const setSort = (filters: SearchFilters, value: string): SearchFilters => ({
  ...filters,
  sort: value === 'best' ? undefined : (value as SearchSort),
});
const setList = (filters: SearchFilters, key: ListKey, values: string[]): SearchFilters => ({ ...filters, [key]: values });
const anyFilter = (f: SearchFilters) => Boolean(f.platforms?.length || f.genres?.length || f.years?.length);

/** Computers and tablets: platform, genre, year and sort in a row above the results. */
export default function SearchFilterBar({ filters, onChange }: Props) {
  return (
    <div className="filter-bar" id="search-filters" role="group" aria-label="Filter and sort the results" data-testid="search-filters">
      <MultiDropdown label="Platform" anyLabel="Any platform" options={PLATFORMS} values={filters.platforms ?? []} onChange={(v) => onChange(setList(filters, 'platforms', v))} testId="filter-platform" />
      <MultiDropdown label="Genre" anyLabel="Any genre" options={GENRES} values={filters.genres ?? []} onChange={(v) => onChange(setList(filters, 'genres', v))} testId="filter-genre" />
      <MultiDropdown label="Release year" anyLabel="Any year" options={YEAR_OPTIONS} values={filters.years ?? []} onChange={(v) => onChange(setList(filters, 'years', v))} testId="filter-year" />
      <Dropdown label="Sort" value={filters.sort ?? 'best'} options={SORTS} onChange={(v) => onChange(setSort(filters, v))} highlightWhenSet={false} testId="filter-sort" />
      {anyFilter(filters) && (
        <button type="button" className="filter-clear" onClick={() => onChange({ sort: filters.sort })} data-testid="filter-clear">
          Clear filters
        </button>
      )}
    </div>
  );
}

/**
 * Phones: the filters in a drawer that slides up from the bottom. Sort, platforms and genres as tap-able
 * chips (several platforms / genres can be on); years as a checkbox list. Every change applies straight away.
 */
export function FilterDrawer({ filters, onChange, open, onClose }: Props & { open: boolean; onClose(): void }) {
  // In the page only while open or sliding shut; "shown" = slid up.
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      let second = 0;
      const first = requestAnimationFrame(() => (second = requestAnimationFrame(() => setShown(true))));
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }
    setShown(false);
    const timer = window.setTimeout(() => setMounted(false), 300);
    return () => window.clearTimeout(timer);
  }, [open]);

  // While it's open: the page behind doesn't scroll, and Esc closes it.
  useEffect(() => {
    if (!open) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = before;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  // Sort: pick one
  const sortChips = (
    <div className="chip-choices" role="radiogroup" aria-label="Sort by">
      {SORTS.map((o) => {
        const on = (filters.sort ?? 'best') === o.value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} className={`chip-choice ${on ? 'chosen' : ''}`} onClick={() => onChange(setSort(filters, o.value))}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
  // Platforms / genres: tick as many as you like ("Any" clears them)
  const multiChips = (key: ListKey, anyLabel: string, options: DropdownOption[]) => {
    const values = filters[key] ?? [];
    const toggle = (v: string) =>
      onChange(setList(filters, key, values.includes(v) ? values.filter((x) => x !== v) : options.map((o) => o.value).filter((x) => x === v || values.includes(x))));
    return (
      <div className="chip-choices" role="group">
        <button type="button" aria-pressed={values.length === 0} className={`chip-choice ${values.length === 0 ? 'chosen' : ''}`} onClick={() => onChange(setList(filters, key, []))}>
          {anyLabel}
        </button>
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={values.includes(o.value)} className={`chip-choice ${values.includes(o.value) ? 'chosen' : ''}`} onClick={() => toggle(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className={`drawer-layer ${shown ? 'open' : ''}`} data-testid="filter-drawer">
      <div className="drawer-backdrop" onClick={onClose} aria-hidden />
      <div className="drawer" role="dialog" aria-modal="true" aria-label="Filters" id="search-filters">
        <div className="drawer-head">
          <span className="drawer-grip" aria-hidden />
          <h2 className="drawer-title">Filters</h2>
          <button type="button" className="field-clear drawer-close" onClick={onClose} aria-label="Close filters">
            <CloseIcon size={12} />
          </button>
        </div>

        <div className="drawer-body">
          <section className="drawer-section">
            <h3>Sort by</h3>
            {sortChips}
          </section>
          <section className="drawer-section">
            <h3>Platform</h3>
            {multiChips('platforms', 'Any platform', PLATFORMS)}
          </section>
          <section className="drawer-section">
            <h3>Genre</h3>
            {multiChips('genres', 'Any genre', GENRES)}
          </section>
          <section className="drawer-section">
            <h3>Release year</h3>
            <MultiDropdown
              label="Release year"
              anyLabel="Any year"
              options={YEAR_OPTIONS}
              values={filters.years ?? []}
              onChange={(v) => onChange(setList(filters, 'years', v))}
              inline
              testId="filter-year"
            />
          </section>
        </div>

        <div className="drawer-foot">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => onChange({})}
            disabled={!anyFilter(filters) && !filters.sort}
          >
            Clear all
          </button>
          <button type="button" className="btn-primary" onClick={onClose} data-testid="filter-drawer-done">
            Show results
          </button>
        </div>
      </div>
    </div>
  );
}
