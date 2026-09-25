// Visit counting for the /stats page. Records one row per page view in Supabase (table page_views):
// the page, logged in or not, and an anonymous random ID kept in this browser (so repeat visits count as
// one visitor). No IP address, no name, no email. Visits from your own computer (npm run dev) aren't counted.
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const VISITOR_KEY = 'fmg-visitor';
let visitorId: string | null = null;

function randomId(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  // older browsers: build a random UUID by hand
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function getVisitorId(): string {
  if (visitorId) return visitorId;
  try {
    visitorId = localStorage.getItem(VISITOR_KEY);
    if (!visitorId) {
      visitorId = randomId();
      localStorage.setItem(VISITOR_KEY, visitorId);
    }
  } catch {
    visitorId ??= randomId(); // storage blocked: counted as a new visitor per page load, that's all
  }
  return visitorId;
}

const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
let last = { path: '', at: 0 };

/** Records a page view. Never throws: counting must never get in the way of using the site. */
export function recordPageView(path: string, userId: string | null): void {
  if (!isSupabaseConfigured || isLocal) return;
  // The same page twice within 2 seconds (e.g. React's double run) is one view.
  const now = Date.now();
  if (last.path === path && now - last.at < 2000) return;
  last = { path, at: now };
  void supabase
    .from('page_views')
    .insert({ visitor_id: getVisitorId(), user_id: userId, path: path.slice(0, 200) })
    .then(() => undefined, () => undefined);
}

export interface SiteStats {
  accounts: number;
  totals: Record<'today' | 'week' | 'month' | 'all', {
    views: number;
    visitors: number;
    logged_in_users: number;
    logged_out_visitors: number;
  }>;
  daily: { day: string; logged_in: number; logged_out: number; views: number }[];
  pages: { path: string; views: number; visitors: number }[];
}

/** The totals, or null when you're not the site admin (the database only answers the admin). */
export async function getSiteStats(days = 30): Promise<SiteStats | null> {
  const { data, error } = await supabase.rpc('site_stats', { days });
  if (error) throw new Error(`Couldn't load the statistics: ${error.message}`);
  return (data as SiteStats | null) ?? null;
}

export type Period = 'today' | 'week' | 'month' | 'all';

export interface Visitor {
  /** "user": a logged-in account (who = email); "visitor": a logged-out browser (who = short random code) */
  kind: 'user' | 'visitor';
  who: string;
  first_seen: string;
  last_seen: string;
  views: number;
  pages: number;
  last_page: string;
}

/** Who visited in a period, newest visit first (admin only). */
export async function getVisitors(period: Period): Promise<Visitor[]> {
  const { data, error } = await supabase.rpc('site_visitors', { period });
  if (error) throw new Error(`Couldn't load the visitors: ${error.message}`);
  return (data as Visitor[]) ?? [];
}
