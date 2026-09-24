// Client for the CheapShark API (https://apidocs.cheapshark.com/).
// Free, no key needed. It tracks PC game prices across Steam, GOG, Humble, Fanatical, GMG and 30+ other stores.
// Rules: send users to deals through CheapShark's redirect links, and don't hammer the API.
// Prices are in US dollars.

const BASE_URL = 'https://www.cheapshark.com/api/1.0';
const SITE_URL = 'https://www.cheapshark.com';

interface CsGameListItem {
  gameID: string;
  steamAppID: string | null;
  cheapest: string;
  external: string;
  thumb: string;
}

interface CsGameLookup {
  info: { title: string; steamAppID: string | null; thumb: string };
  cheapestPriceEver: { price: string; date: number };
  deals: { storeID: string; dealID: string; price: string; retailPrice: string; savings: string }[];
}

interface CsStore {
  storeID: string;
  storeName: string;
  isActive: number;
  images: { banner: string; logo: string; icon: string };
}

export interface Deal {
  storeId: string;
  storeName: string;
  storeIcon: string | null;
  price: number;
  retailPrice: number;
  savingsPercent: number; // 0 when not discounted
  url: string;
}

export interface GameDeals {
  /** CheapShark's own ID for the game (price alerts use it). */
  cheapsharkId: string;
  title: string;
  deals: Deal[]; // cheapest first
  lowestEver: { price: number; date: Date } | null;
}

const UNAVAILABLE = 'Store prices are unavailable right now (CheapShark isn\'t responding). Try again in a minute.';

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

/** One request to CheapShark. If it fails (service down, or busy), waits a moment and tries once more. */
async function get<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const url = `${BASE_URL}${path}?${new URLSearchParams(params)}`;
  for (let attempt = 1; ; attempt++) {
    try {
      // When CheapShark is down or has had too many requests, the browser often only says "Failed to fetch".
      const res = await fetch(url, { signal });
      if (res.ok) return (await res.json()) as T;
      if (res.status !== 429 && res.status < 500) throw new Error(`Price lookup failed (${res.status})`);
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
      if ((err as Error).message.startsWith('Price lookup failed')) throw err;
    }
    if (attempt >= 2) throw new Error(UNAVAILABLE);
    await wait(1500, signal);
  }
}

// Store names rarely change, so fetch them once per app session.
let storesPromise: Promise<Map<string, CsStore>> | null = null;
function getStores(): Promise<Map<string, CsStore>> {
  storesPromise ??= get<CsStore[]>('/stores', {})
    .then((list) => new Map(list.map((s) => [s.storeID, s])))
    .catch((err) => {
      storesPromise = null; // allow a retry next time
      throw err;
    });
  return storesPromise;
}

/** Lowercase, drop punctuation and trademark symbols so "The Witcher® 3: Wild Hunt" matches "the witcher 3 wild hunt". */
function normalize(title: string): string {
  return title
    .toLowerCase()
    .replace(/[®™©]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Finds CheapShark's ID for a game: by Steam app ID when we know it (exact), otherwise by title. */
async function findGameId(name: string, steamAppId: string | null, signal?: AbortSignal): Promise<string | null> {
  if (steamAppId) {
    const bySteam = await get<CsGameListItem[]>('/games', { steamAppID: steamAppId, limit: '1' }, signal);
    if (bySteam.length > 0) return bySteam[0].gameID;
  }
  const byTitle = await get<CsGameListItem[]>('/games', { title: name, limit: '20' }, signal);
  const wanted = normalize(name);
  const match = byTitle.find((g) => normalize(g.external) === wanted);
  return match ? match.gameID : null;
}

/** Current prices for a game across PC stores, or null if CheapShark doesn't track it. */
export async function getGameDeals(
  name: string,
  steamAppId: string | null,
  signal?: AbortSignal,
): Promise<GameDeals | null> {
  const gameId = await findGameId(name, steamAppId, signal);
  if (!gameId) return null;

  const [lookup, stores] = await Promise.all([
    get<CsGameLookup>('/games', { id: gameId }, signal),
    getStores(),
  ]);

  const deals: Deal[] = lookup.deals
    .filter((d) => stores.get(d.storeID)?.isActive !== 0) // skip stores CheapShark marks as closed
    .map((d) => {
      const store = stores.get(d.storeID);
      return {
        storeId: d.storeID,
        storeName: store?.storeName ?? `Store ${d.storeID}`,
        storeIcon: store ? SITE_URL + store.images.icon : null,
        price: Number(d.price),
        retailPrice: Number(d.retailPrice),
        savingsPercent: Math.round(Number(d.savings)),
        url: `${SITE_URL}/redirect?dealID=${encodeURIComponent(d.dealID)}`,
      };
    })
    .sort((a, b) => a.price - b.price);

  const ever = lookup.cheapestPriceEver;
  return {
    cheapsharkId: gameId,
    title: lookup.info.title,
    deals,
    lowestEver: ever?.price ? { price: Number(ever.price), date: new Date(ever.date * 1000) } : null,
  };
}

export interface BestPrice {
  price: number;
  storeName: string;
}

/**
 * Today's cheapest price for several games at once (by CheapShark ID), in as few requests as possible
 * (CheapShark looks up to 25 games per request). Games with no current price are left out.
 */
export async function getBestPrices(cheapsharkIds: string[], signal?: AbortSignal): Promise<Map<string, BestPrice>> {
  const result = new Map<string, BestPrice>();
  const ids = [...new Set(cheapsharkIds)];
  if (ids.length === 0) return result;

  const stores = await getStores();
  for (let i = 0; i < ids.length; i += 25) {
    const chunk = ids.slice(i, i + 25);
    const found = await get<Record<string, CsGameLookup>>('/games', { ids: chunk.join(',') }, signal);
    for (const id of chunk) {
      const deals = (found[id]?.deals ?? []).filter((d) => stores.get(d.storeID)?.isActive !== 0);
      if (deals.length === 0) continue;
      const best = deals.reduce((a, b) => (Number(b.price) < Number(a.price) ? b : a));
      result.set(id, {
        price: Number(best.price),
        storeName: stores.get(best.storeID)?.storeName ?? `Store ${best.storeID}`,
      });
    }
  }
  return result;
}
