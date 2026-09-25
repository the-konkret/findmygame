import { useState } from 'react';
import { getTheme, setTheme, type Theme } from '../lib/theme';

const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

/** "Appearance" on the settings page: Dark (default) or Light, applied straight away. */
export default function ThemePicker() {
  const [theme, setChoice] = useState<Theme>(getTheme);

  function choose(value: Theme) {
    setChoice(value);
    setTheme(value);
  }

  return (
    <div className="panel account-section" data-testid="theme-section">
      <h2>Appearance</h2>
      <fieldset className="theme-options">
        <legend className="sr-only">Colour theme</legend>
        {OPTIONS.map((o) => (
          <label key={o.value} className={`theme-option ${theme === o.value ? 'selected' : ''}`}>
            <input
              type="radio"
              name="theme"
              value={o.value}
              checked={theme === o.value}
              onChange={() => choose(o.value)}
              data-testid={`theme-${o.value}`}
            />
            <span className={`theme-swatch theme-swatch-${o.value}`} aria-hidden="true">
              <span />
            </span>
            {o.label}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
