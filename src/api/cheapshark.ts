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

const UNAVAILABLE = "Store prices are unavailable right now (CheapShark isn't responding). Try again in a minute.";
const BUSY = 'CheapShark has had too many price requests from you for now. Try again in a few minutes.';

// ---- Asking CheapShark as little as possible ----
// CheapShark is free and limits how often one visitor may ask (it answers "429 Too Many Requests", and
// blocks for longer if you keep asking). So every answer is remembered (in this browser, across reloads)
// for a while, and identical requests made at the same moment share one trip.

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const STORAGE_PREFIX = 'fmg-cs:';

interface Remembered { at: number; data: unknown }
const memory = new Map<string, Remembered>();
const inFlight = new Map<string, Promise<unknown>>();

function recall(url: string, maxAge: number): unknown | undefined {
  let hit = memory.get(url);
  if (!hit) {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + url);
      if (saved) hit = JSON.parse(saved) as Remembered;
    } catch {
      // storage blocked or full: just ask again
    }
  }
  if (!hit || Date.now() - hit.at > maxAge) return undefined;
  memory.set(url, hit);
  return hit.data;
}

function remember(url: string, data: unknown): void {
  const entry = { at: Date.now(), data };
  memory.set(url, entry);
  try {
    localStorage.setItem(STORAGE_PREFIX + url, JSON.stringify(entry));
  } catch {
    // storage full: tidy up our old entries, it'll be remembered in memory anyway
    try {
      Object.keys(localStorage).filter((k) => k.startsWith(STORAGE_PREFIX)).forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  }
}

function aborted(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

/** The actual trip to CheapShark. A network hiccup gets one more try after 2 s; "too many requests" never does. */
async function fetchJson(url: string): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      // Service down (or blocked): the browser only says "Failed to fetch".
      if (attempt >= 2) throw new Error(UNAVAILABLE);
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    if (res.ok) return res.json();
    if (res.status === 429) throw new Error(BUSY);
    if (res.status >= 500) throw new Error(UNAVAILABLE);
    throw new Error(`Price lookup failed (${res.status})`);
  }
}

/**
 * One CheapShark request, answered from memory when a recent enough answer exists.
 * maxAge: how old a remembered answer may be. If `signal` is aborted (you left the page), this throws
 * AbortError, but the trip itself finishes and is remembered for next time.
 */
async function get<T>(path: string, params: Record<string, string>, signal?: AbortSignal, maxAge = 10 * MINUTE): Promise<T> {
  const url = `${BASE_URL}${path}?${new URLSearchParams(params)}`;
  const known = recall(url, maxAge);
  if (known !== undefined) return known as T;
  if (signal?.aborted) throw aborted();

  let trip = inFlight.get(url);
  if (!trip) {
    trip = fetchJson(url)
      .then((data) => {
        remember(url, data);
        return data;
      })
      .finally(() => inFlight.delete(url));
    inFlight.set(url, trip);
  }
  const data = await trip;
  if (signal?.aborted) throw aborted();
  return data as T;
}

// Store names rarely change: remembered for a day.
let storesPromise: Promise<Map<string, CsStore>> | null = null;
function getStores(): Promise<Map<string, CsStore>> {
  storesPromise ??= get<CsStore[]>('/stores', {}, undefined, DAY)
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
export async function findGameId(name: string, steamAppId: string | null, signal?: AbortSignal): Promise<string | null> {
  if (steamAppId) {
    const bySteam = await get<CsGameListItem[]>('/games', { steamAppID: steamAppId, limit: '1' }, signal, 7 * DAY);
    if (bySteam.length > 0) return bySteam[0].gameID;
  }
  const byTitle = await get<CsGameListItem[]>('/games', { title: name, limit: '20' }, signal, 7 * DAY);
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

// ---- Rankings: best deals right now ----

interface CsDealListItem {
  title: string;
  gameID: string;
  dealID: string;
  storeID: string;
  salePrice: string;
  normalPrice: string;
  savings: string;
  steamAppID: string | null;
  thumb: string;
  metacriticScore: string;
  steamRatingPercent: string;
}

export interface TopDeal {
  title: string;
  steamAppId: string | null;
  image: string;
  price: number;
  normalPrice: number;
  savingsPercent: number;
  storeName: string;
  url: string;
}

/** CheapShark's best current deals (its own "deal rating": discount, price and reviews together), one per game. */
export async function getTopDeals(signal?: AbortSignal): Promise<TopDeal[]> {
  const [list, stores] = await Promise.all([
    get<CsDealListItem[]>('/deals', { pageSize: '60', sortBy: 'Deal Rating' }, signal, 30 * MINUTE),
    getStores(),
  ]);
  const seen = new Set<string>();
  const deals: TopDeal[] = [];
  for (const d of list) {
    if (seen.has(d.gameID) || stores.get(d.storeID)?.isActive === 0) continue;
    seen.add(d.gameID);
    deals.push({
      title: d.title,
      steamAppId: d.steamAppID || null,
      // Steam's wide picture when it's a Steam game; otherwise CheapShark's small one.
      image: d.steamAppID ? `https://cdn.akamai.steamstatic.com/steam/apps/${d.steamAppID}/header.jpg` : d.thumb,
      price: Number(d.salePrice),
      normalPrice: Number(d.normalPrice),
      savingsPercent: Math.round(Number(d.savings)),
      storeName: stores.get(d.storeID)?.storeName ?? `Store ${d.storeID}`,
      url: `${SITE_URL}/redirect?dealID=${encodeURIComponent(d.dealID)}`,
    });
    if (deals.length >= 24) break;
  }
  return deals;
}

