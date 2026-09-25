// Scheduled price check (runs on Cloudflare every few hours; see "triggers" in wrangler.jsonc).
// It does what an open FindMyGame tab does, but for everyone and without anyone visiting:
//   1. reads all price alerts still waiting (Supabase, with the secret key, which can see every user's alerts),
//   2. looks up today's best PC price for those games on CheapShark,
//   3. marks the alerts whose price has been reached, so the notification is waiting under the bell.
// Nobody is emailed; the bell shows it on the next visit.
//
// Needs (Cloudflare → Worker → Settings → Variables and Secrets):
//   SUPABASE_SECRET_KEY  (Secret)  Supabase → Project Settings → API Keys → Secret keys (sb_secret_...)
//   SUPABASE_URL         (plain, already in wrangler.jsonc)
//   ALERT_RUN_KEY        (Secret, optional) lets you start a check by hand: POST /api/alerts/run

export interface PriceCheckEnv {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
}

interface WaitingAlert {
  user_id: string;
  game_id: number;
  cheapshark_id: string;
  target_price: number | string;
}

interface CsDeal { storeID: string; price: string }
interface CsStore { storeID: string; storeName: string; isActive: number }

export interface CheckSummary {
  waiting: number; // alerts still waiting before this run
  games: number; // different games looked up
  reached: number; // alerts marked as reached in this run
  errors: string[];
}

type Fetch = typeof fetch;
const CHEAPSHARK = 'https://www.cheapshark.com/api/1.0';
const USER_AGENT = 'FindMyGame price check (+https://github.com/the-konkret/findmygame)';

export async function runPriceCheck(env: PriceCheckEnv, fetchFn: Fetch = fetch): Promise<CheckSummary> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    throw new Error('Price check is not set up: missing SUPABASE_URL or SUPABASE_SECRET_KEY');
  }
  const summary: CheckSummary = { waiting: 0, games: 0, reached: 0, errors: [] };
  const db = supabase(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, fetchFn);

  const alerts = await db.waiting();
  summary.waiting = alerts.length;
  if (alerts.length === 0) return summary;

  const ids = [...new Set(alerts.map((a) => a.cheapshark_id))];
  summary.games = ids.length;
  const prices = await bestPrices(ids, fetchFn, summary.errors);

  for (const alert of alerts) {
    const best = prices.get(alert.cheapshark_id);
    if (!best || best.price > Number(alert.target_price)) continue;
    try {
      await db.markReached(alert, best);
      summary.reached++;
    } catch (err) {
      summary.errors.push(`game ${alert.game_id}: ${(err as Error).message}`);
    }
  }
  return summary;
}

// ---- Supabase (its REST API, with the secret key) ----

function supabase(url: string, key: string, fetchFn: Fetch) {
  const base = `${url.replace(/\/$/, '')}/rest/v1/price_alerts`;
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  // New-style keys (sb_secret_...) go only in "apikey"; old-style ones (long "eyJ..." keys) also as a Bearer token.
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;

  return {
    async waiting(): Promise<WaitingAlert[]> {
      const res = await fetchFn(`${base}?select=user_id,game_id,cheapshark_id,target_price&notified_at=is.null&limit=10000`, {
        headers,
      });
      if (!res.ok) throw new Error(`Supabase read failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
      return (await res.json()) as WaitingAlert[];
    },
    async markReached(alert: WaitingAlert, best: { price: number; storeName: string }): Promise<void> {
      // "notified_at=is.null": if the person's own browser marked it a moment ago, leave that as it is.
      const res = await fetchFn(`${base}?user_id=eq.${alert.user_id}&game_id=eq.${alert.game_id}&notified_at=is.null`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({
          notified_at: new Date().toISOString(),
          notified_price: best.price,
          notified_store: best.storeName,
        }),
      });
      if (!res.ok) throw new Error(`marking failed (${res.status})`);
    },
  };
}

// ---- CheapShark ----

async function csGet<T>(fetchFn: Fetch, path: string, params: Record<string, string>): Promise<T> {
  const res = await fetchFn(`${CHEAPSHARK}${path}?${new URLSearchParams(params)}`, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`CheapShark ${path} failed (${res.status})`);
  return (await res.json()) as T;
}

/** Today's cheapest price per CheapShark game ID (up to 25 games per request). Games with no price are left out. */
export async function bestPrices(
  ids: string[],
  fetchFn: Fetch,
  errors: string[] = [],
): Promise<Map<string, { price: number; storeName: string }>> {
  const stores = new Map((await csGet<CsStore[]>(fetchFn, '/stores', {})).map((s) => [s.storeID, s] as const));
  const result = new Map<string, { price: number; storeName: string }>();

  for (let i = 0; i < ids.length; i += 25) {
    const chunk = ids.slice(i, i + 25);
    let found: Record<string, { deals?: CsDeal[] }>;
    try {
      found = await csGet(fetchFn, '/games', { ids: chunk.join(',') });
    } catch (err) {
      errors.push((err as Error).message);
      continue; // try these again next run
    }
    for (const id of chunk) {
      const deals = (found?.[id]?.deals ?? []).filter((d) => stores.get(d.storeID)?.isActive !== 0);
      if (deals.length === 0) continue;
      const best = deals.reduce((a, b) => (Number(b.price) < Number(a.price) ? b : a));
      result.set(id, { price: Number(best.price), storeName: stores.get(best.storeID)?.storeName ?? `Store ${best.storeID}` });
    }
    if (i + 25 < ids.length) await new Promise((r) => setTimeout(r, 1000)); // be gentle with CheapShark
  }
  return result;
}
