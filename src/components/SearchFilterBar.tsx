import type { ReactNode } from 'react';
import { GENRE_FILTERS, PLATFORM_FILTERS, SORT_OPTIONS, type SearchFilters, type SearchSort } from '../api/rawg';

// Release years to choose from: this year (and next, for upcoming games) back to 1980.
const NOW = new Date().getFullYear();
const YEARS = Array.from({ length: NOW + 1 - 1980 + 1 }, (_, i) => String(NOW + 1 - i));

/** Platform, genre, year and sort, above the search results. Changing one searches again straight away. */
export default function SearchFilterBar({
  filters,
  onChange,
}: {
  filters: SearchFilters;
  onChange(next: SearchFilters): void;
}) {
  const active = Boolean(filters.platform || filters.genre || filters.year);
  const set = (key: keyof SearchFilters, value: string) => onChange({ ...filters, [key]: value || undefined });

  return (
    <div className="filter-bar" id="search-filters" role="group" aria-label="Filter and sort the results" data-testid="search-filters">
      <Choice label="Platform" value={filters.platform ?? ''} onChange={(v) => set('platform', v)} testId="filter-platform">
        <option value="">Any platform</option>
        {PLATFORM_FILTERS.map((p) => (
          <option key={p.key} value={p.key}>{p.label}</option>
        ))}
      </Choice>
      <Choice label="Genre" value={filters.genre ?? ''} onChange={(v) => set('genre', v)} testId="filter-genre">
        <option value="">Any genre</option>
        {GENRE_FILTERS.map((g) => (
          <option key={g.key} value={g.key}>{g.label}</option>
        ))}
      </Choice>
      <Choice label="Year" value={filters.year ?? ''} onChange={(v) => set('year', v)} testId="filter-year">
        <option value="">Any year</option>
        {YEARS.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </Choice>
      <Choice
        label="Sort"
        value={filters.sort ?? 'best'}
        onChange={(v) => onChange({ ...filters, sort: v === 'best' ? undefined : (v as SearchSort) })}
        testId="filter-sort"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </Choice>
      {active && (
        <button
          type="button"
          className="filter-clear"
          onClick={() => onChange({ sort: filters.sort })}
          data-testid="filter-clear"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function Choice({
  label,
  value,
  onChange,
  testId,
  children,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  testId: string;
  children: ReactNode;
}) {
  const set = value !== '' && value !== 'best';
  return (
    <label className={`filter ${set ? 'set' : ''}`}>
      <span className="sr-only">{label}</span>
      <select className="sort-select filter-select" value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId}>
        {children}
      </select>
    </label>
  );
}
