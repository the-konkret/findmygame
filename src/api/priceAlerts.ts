// Price alerts: "tell me when this game costs $X or less". Stored in Supabase (table price_alerts).
// While you have FindMyGame open, the app checks the prices (see useNotifications); when one reaches your
// price, the alert turns into a notification under the bell in the top bar.
// Row Level Security makes sure you only ever see and change your own alerts.
import { supabase } from '../lib/supabase';
import { getBestPrices, type BestPrice } from './cheapshark';
import type { GameRef } from './userData';

export interface PriceAlert {
  game_id: number;
  game_name: string;
  game_image: string | null;
  cheapshark_id: string;
  target_price: number;
  created_at: string;
  /** When the price first reached the target (the alert is then a notification). */
  notified_at: string | null;
  notified_price: number | null;
  notified_store: string | null;
  /** When you opened the bell after that; empty = unread. */
  read_at: string | null;
}

const COLUMNS =
  'game_id, game_name, game_image, cheapshark_id, target_price, created_at, notified_at, notified_price, notified_store, read_at';
const TABLE = 'price_alerts';

function check(error: { message: string } | null): void {
  if (error) throw new Error(`Couldn't reach your price alerts: ${error.message}`);
}

/** Supabase can send prices back as text; make sure they're numbers. */
function clean(row: PriceAlert): PriceAlert {
  return {
    ...row,
    target_price: Number(row.target_price),
    notified_price: row.notified_price == null ? null : Number(row.notified_price),
  };
}

// ---- Telling the rest of the app that alerts changed (the bell and the game page stay in step) ----

const changes = new EventTarget();
export function onAlertsChanged(listener: () => void): () => void {
  changes.addEventListener('change', listener);
  return () => changes.removeEventListener('change', listener);
}
function announceChange(): void {
  changes.dispatchEvent(new Event('change'));
}

// ---- Reading and saving ----

export async function getAlert(gameId: number): Promise<PriceAlert | null> {
  const { data, error } = await supabase.from(TABLE).select(COLUMNS).eq('game_id', gameId).maybeSingle();
  check(error);
  return data ? clean(data as PriceAlert) : null;
}

export async function listAlerts(): Promise<PriceAlert[]> {
  const { data, error } = await supabase.from(TABLE).select(COLUMNS).order('created_at', { ascending: false });
  check(error);
  return ((data ?? []) as PriceAlert[]).map(clean);
}

/** Creates or changes the alert for a game. Setting it again starts watching afresh (the old notification goes). */
export async function saveAlert(game: GameRef, cheapsharkId: string, targetPrice: number): Promise<PriceAlert> {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        game_id: game.id,
        game_name: game.name,
        game_image: game.background_image ?? null,
        cheapshark_id: cheapsharkId,
        target_price: Math.round(targetPrice * 100) / 100,
        created_at: new Date().toISOString(),
        notified_at: null,
        notified_price: null,
        notified_store: null,
        read_at: null,
      },
      { onConflict: 'user_id,game_id' },
    )
    .select(COLUMNS)
    .single();
  check(error);
  announceChange();
  return clean(data as PriceAlert);
}

export async function deleteAlert(gameId: number): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('game_id', gameId);
  check(error);
  announceChange();
}

/** Marks every notification as read (done when you open the bell). */
export async function markAllRead(): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ read_at: new Date().toISOString() })
    .not('notified_at', 'is', null)
    .is('read_at', null);
  check(error);
}

// ---- Checking prices ----

/** Prices are remembered for 10 minutes, so moving around the site doesn't ask CheapShark again and again. */
const PRICE_MAX_AGE_MS = 10 * 60 * 1000;
const priceCache = new Map<string, { best: BestPrice | null; at: number }>();

async function currentPrices(ids: string[]): Promise<Map<string, BestPrice>> {
  const now = Date.now();
  const stale = ids.filter((id) => (priceCache.get(id)?.at ?? 0) < now - PRICE_MAX_AGE_MS);
  if (stale.length > 0) {
    const fresh = await getBestPrices(stale);
    for (const id of stale) priceCache.set(id, { best: fresh.get(id) ?? null, at: now });
  }
  const result = new Map<string, BestPrice>();
  for (const id of ids) {
    const best = priceCache.get(id)?.best;
    if (best) result.set(id, best);
  }
  return result;
}

export interface AlertsWithPrices {
  alerts: PriceAlert[];
  /** Today's best price per CheapShark ID (missing if CheapShark couldn't be reached). */
  prices: Map<string, BestPrice>;
  priceError: string;
}

/**
 * Loads your alerts, checks today's prices, and turns every alert whose price has reached the target
 * into a notification. Returns the alerts (notifications included) and the prices.
 */
export async function checkAlerts(): Promise<AlertsWithPrices> {
  const alerts = await listAlerts();
  let prices = new Map<string, BestPrice>();
  let priceError = '';
  try {
    prices = await currentPrices(alerts.map((a) => a.cheapshark_id));
  } catch (e) {
    priceError = (e as Error).message;
  }

  let changed = false;
  for (const alert of alerts) {
    const best = prices.get(alert.cheapshark_id);
    if (alert.notified_at || !best || best.price > alert.target_price) continue;
    const update = { notified_at: new Date().toISOString(), notified_price: best.price, notified_store: best.storeName };
    const { error } = await supabase
      .from(TABLE)
      .update(update)
      .eq('game_id', alert.game_id)
      .is('notified_at', null);
    if (error) continue; // try again on the next check
    Object.assign(alert, update);
    changed = true;
  }
  if (changed) announceChange();
  return { alerts, prices, priceError };
}

/** Reads what someone typed ("12", "$9.99", "4,50") as a price, or null if it isn't one. */
export function parsePrice(text: string): number | null {
  const cleaned = text.trim().replace(/^\$/, '').replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return value > 0 ? value : null;
}
