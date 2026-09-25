// "Most played on Steam": SteamSpy's top 100 by players in the last two weeks (free, no key, unofficial
// estimates). SteamSpy doesn't allow browsers to ask it directly, so the request goes through our Worker
// (/api/steamspy/...), which also remembers the answer for a few hours.

interface SpyGame {
  appid: number;
  name: string;
  ccu: number; // most players online at the same time, yesterday
  owners: string; // e.g. "20,000,000 .. 50,000,000"
  positive: number;
  negative: number;
}

export interface SteamGame {
  appId: number;
  name: string;
  image: string;
  peakPlayers: number;
  /** % of Steam reviews that are positive, or null with too few reviews */
  positivePercent: number | null;
}

export async function getMostPlayed(signal?: AbortSignal): Promise<SteamGame[]> {
  const res = await fetch('/api/steamspy/top100in2weeks', { signal });
  if (!res.ok) throw new Error(`Couldn't load the Steam ranking (${res.status}). Try again later.`);
  const data = (await res.json()) as Record<string, SpyGame> | SpyGame[];
  const list = Array.isArray(data) ? data : Object.values(data);
  // The list comes keyed by Steam ID (so in ID order): put it in order of how many play it.
  return list
    .filter((g) => g && g.name)
    .sort((a, b) => b.ccu - a.ccu)
    .slice(0, 24)
    .map((g) => {
      const reviews = g.positive + g.negative;
      return {
        appId: g.appid,
        name: g.name,
        image: `https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/header.jpg`,
        peakPlayers: g.ccu,
        positivePercent: reviews >= 50 ? Math.round((g.positive / reviews) * 100) : null,
      };
    });
}
