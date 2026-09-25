import { useState } from 'react';

export interface SortOption<K extends string> {
  key: K;
  label: string;
}

/** Remembers the chosen sort for a page in this browser (so it's the same next time you come back). */
export function useSavedSort<K extends string>(page: string, options: SortOption<K>[], fallback: K) {
  const storageKey = `fmg-sort:${page}`;
  const [sort, setSort] = useState<K>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && options.some((o) => o.key === saved)) return saved as K;
    } catch {
      // storage blocked (private window etc.): just use the default
    }
    return fallback;
  });
  function choose(next: K) {
    setSort(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // not remembered, but still works
    }
  }
  return [sort, choose] as const;
}

/** A small "Sort by" dropdown for list pages. */
export default function SortSelect<K extends string>({
  value,
  options,
  onChange,
  testId,
}: {
  value: K;
  options: SortOption<K>[];
  onChange(next: K): void;
  testId?: string;
}) {
  return (
    <label className="sort-by">
      <span className="sort-label">Sort by</span>
      <select
        className="sort-select"
        value={value}
        onChange={(e) => onChange(e.target.value as K)}
        data-testid={testId}
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
