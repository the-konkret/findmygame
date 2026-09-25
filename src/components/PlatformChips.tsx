import type { ReactNode } from 'react';

// Platforms as tidy chips: one per family (PC, PlayStation, Xbox…), a simple generic icon, and the
// versions next to it ("PlayStation 4 · 5"). Generic drawings on purpose: the platform makers' logos
// are their trademarks.

interface Platform {
  platform: { name: string; slug: string };
}

interface Family {
  key: string;
  label: string;
  icon: ReactNode;
  match: (slug: string) => boolean;
  /** the version part of a name, e.g. "PlayStation 5" → "5" */
  version?: (name: string) => string;
}

const svg = (children: ReactNode) => (
  <svg className="icon" width={16} height={16} viewBox="0 0 24 24" aria-hidden="true" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
const Screen = svg(<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>);
const Gamepad = svg(
  <>
    <path d="M7 7h10a5 5 0 0 1 4.9 6l-.6 3a2.5 2.5 0 0 1-4.3 1.2L15 15H9l-2 2.2A2.5 2.5 0 0 1 2.7 16l-.6-3A5 5 0 0 1 7 7Z" />
    <path d="M7 10v3M5.5 11.5h3" />
    <circle cx="16" cy="10.5" r=".6" fill="currentColor" /><circle cx="17.5" cy="12.5" r=".6" fill="currentColor" />
  </>,
);
const Handheld = svg(<><rect x="2" y="6" width="20" height="12" rx="3" /><rect x="8" y="9" width="8" height="6" rx="1" /></>);
const Laptop = svg(<><rect x="4" y="5" width="16" height="10" rx="1.5" /><path d="M2 19h20" /></>);
const Phone = svg(<><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18h2" /></>);
const Globe = svg(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>);

const strip = (prefix: RegExp) => (name: string) => name.replace(prefix, '').trim();

const FAMILIES: Family[] = [
  { key: 'pc', label: 'PC', icon: Screen, match: (s) => s === 'pc' },
  {
    key: 'playstation', label: 'PlayStation', icon: Gamepad,
    match: (s) => s.startsWith('playstation') || s === 'ps-vita' || s === 'psp',
    version: (n) => (/^ps vita$/i.test(n) ? 'Vita' : n === 'PSP' ? 'PSP' : strip(/^PlayStation/i)(n) || '1'),
  },
  { key: 'xbox', label: 'Xbox', icon: Gamepad, match: (s) => s.startsWith('xbox'), version: (n) => strip(/^Xbox/i)(n) || 'Original' },
  {
    key: 'nintendo', label: 'Nintendo', icon: Handheld,
    match: (s) => /nintendo|wii|gamecube|game-boy|^nes$|^snes$/.test(s),
    version: strip(/^Nintendo/i),
  },
  {
    key: 'sega', label: 'SEGA', icon: Gamepad,
    match: (s) => s.startsWith('sega') || s === 'genesis' || s === 'dreamcast' || s === 'game-gear',
    version: strip(/^SEGA/i),
  },
  { key: 'atari', label: 'Atari', icon: Gamepad, match: (s) => s.startsWith('atari') || s === 'jaguar', version: strip(/^Atari/i) },
  { key: 'mac', label: 'Mac', icon: Laptop, match: (s) => s === 'macos' || s === 'macintosh' || s === 'apple-ii' },
  { key: 'linux', label: 'Linux', icon: Screen, match: (s) => s === 'linux' },
  { key: 'ios', label: 'iOS', icon: Phone, match: (s) => s === 'ios' },
  { key: 'android', label: 'Android', icon: Phone, match: (s) => s === 'android' },
  { key: 'web', label: 'Browser', icon: Globe, match: (s) => s === 'web' },
];

export default function PlatformChips({ platforms }: { platforms: Platform[] }) {
  const groups: { family: Family; names: string[] }[] = [];
  const others: string[] = [];
  for (const { platform } of platforms) {
    const family = FAMILIES.find((f) => f.match(platform.slug));
    if (!family) {
      others.push(platform.name);
      continue;
    }
    let group = groups.find((g) => g.family.key === family.key);
    if (!group) groups.push((group = { family, names: [] }));
    group.names.push(platform.name);
  }
  groups.sort((a, b) => FAMILIES.indexOf(a.family) - FAMILIES.indexOf(b.family));

  return (
    <ul className="chips" data-testid="platform-chips">
      {groups.map(({ family, names }) => {
        const versions = family.version
          ? names.map(family.version).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
          : [];
        return (
          <li key={family.key} className="chip" title={names.join(', ')}>
            {family.icon}
            <span className="chip-label">{family.label}</span>
            {versions.length > 0 && <span className="chip-extra">{versions.join(' · ')}</span>}
          </li>
        );
      })}
      {others.map((name) => (
        <li key={name} className="chip">
          {Screen}
          <span className="chip-label">{name}</span>
        </li>
      ))}
    </ul>
  );
}

