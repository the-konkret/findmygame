import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { checkAlerts, deleteAlert, onAlertsChanged, type PriceAlert } from '../api/priceAlerts';
import type { BestPrice } from '../api/cheapshark';
import LoadingImage from '../components/LoadingImage';
import { formatDay, usd } from '../lib/format';
import { CloseIcon } from '../components/Icons';
import SortSelect, { useSavedSort, type SortOption } from '../components/SortSelect';

type SortKey = 'recent' | 'reached' | 'closest' | 'name' | 'target' | 'today';

const SORTS: SortOption<SortKey>[] = [
  { key: 'recent', label: 'Recently added' },
  { key: 'reached', label: 'Reached first' },
  { key: 'closest', label: 'Closest to your price' },
  { key: 'name', label: 'Name (A–Z)' },
  { key: 'target', label: 'Your price (lowest)' },
  { key: 'today', label: "Today's price (cheapest)" },
];

function sortAlerts(alerts: PriceAlert[], sort: SortKey, prices: Map<string, BestPrice>): PriceAlert[] {
  const list = [...alerts];
  const byName = (a: PriceAlert, b: PriceAlert) => a.game_name.localeCompare(b.game_name, 'en', { sensitivity: 'base' });
  const recent = (a: PriceAlert, b: PriceAlert) => b.created_at.localeCompare(a.created_at);
  const now = (a: PriceAlert) => prices.get(a.cheapshark_id)?.price;
  // How far today's price is above your price: 0.10 = 10% away. Reached (or below) counts as 0.
  const gap = (a: PriceAlert) => {
    if (a.notified_at) return 0;
    const p = now(a);
    return p == null ? Infinity : Math.max(0, (p - a.target_price) / a.target_price);
  };
  switch (sort) {
    case 'recent':
      return list.sort(recent);
    case 'reached':
      return list.sort(
        (a, b) =>
          (b.notified_at ?? '').localeCompare(a.notified_at ?? '') || recent(a, b), // newest reached first
      );
    case 'closest':
      return list.sort((a, b) => gap(a) - gap(b) || byName(a, b));
    case 'name':
      return list.sort(byName);
    case 'target':
      return list.sort((a, b) => a.target_price - b.target_price || byName(a, b));
    case 'today':
      return list.sort((a, b) => (now(a) ?? Infinity) - (now(b) ?? Infinity) || byName(a, b));
  }
}

/** Every game you've set a price alert on, with your price, today's price and whether it's been reached. */
export default function AlertsPage() {
  const { user, loading } = useAuth();
  const [alerts, setAlerts] = useState<PriceAlert[] | null>(null);
  const [prices, setPrices] = useState<Map<string, BestPrice>>(new Map());
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<number | null>(null);
  const [sort, setSort] = useSavedSort<SortKey>('alerts', SORTS, 'recent');
  const sorted = useMemo(() => (alerts ? sortAlerts(alerts, sort, prices) : null), [alerts, sort, prices]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = () =>
      checkAlerts()
        .then((r) => {
          if (!active) return;
          setAlerts(r.alerts);
          setPrices(r.prices);
          setError(r.priceError ? "Couldn't check today's prices right now." : '');
        })
        .catch((e: Error) => active && setError(e.message));
    load();
    const stop = onAlertsChanged(load); // e.g. removed from the bell
    return () => {
      active = false;
      stop();
    };
  }, [user]);

  if (loading) return <p className="status">Loading…</p>;
  if (!user) return <Navigate to="/login" state={{ from: '/alerts' }} replace />;

  async function onRemove(gameId: number) {
    setRemoving(gameId);
    try {
      await deleteAlert(gameId);
      setAlerts((list) => (list ?? []).filter((a) => a.game_id !== gameId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <section>
      <div className="list-header">
        <h1 className="page-title">Alerts</h1>
        {alerts && alerts.length > 1 && (
          <SortSelect value={sort} options={SORTS} onChange={setSort} testId="alerts-sort" />
        )}
      </div>

      {error && <p className="status error" data-testid="alerts-error">{error}</p>}
      {!error && alerts === null && <p className="status">Loading…</p>}
      {alerts?.length === 0 && (
        <p className="status" data-testid="alerts-empty">
          No price alerts yet. <Link to="/">Find a game</Link>, then use “Notify me when the price drops” in its
          Deals box.
        </p>
      )}

      {sorted && sorted.length > 0 && (
        <div className="grid" data-testid="alerts-list">
          {sorted.map((a) => {
            const now = prices.get(a.cheapshark_id);
            const reached = !!a.notified_at;
            return (
              <div key={a.game_id} className="alert-card-wrap">
                <Link to={`/game/${a.game_id}`} className={`card alert-card ${reached ? 'reached' : ''}`} data-testid="alert-card">
                  <div className="card-image">
                    {a.game_image ? (
                      <LoadingImage src={a.game_image} alt={a.game_name} />
                    ) : (
                      <div className="card-image-empty">No image</div>
                    )}
                    {/* the price you set, on the picture */}
                    <span className="alert-target" data-testid="alert-target">{usd.format(a.target_price)}</span>
                  </div>
                  <div className="card-body">
                    <h3 className="card-title" data-testid="alert-card-title">{a.game_name}</h3>
                    <p className="card-meta">
                      Your price: <strong className="alert-your-price">{usd.format(a.target_price)}</strong> or less
                    </p>
                    <p className={`alert-state ${reached ? 'reached' : ''}`} data-testid="alert-state">
                      {reached
                        ? `Reached on ${formatDay(a.notified_at!)}${a.notified_price != null ? ` at ${usd.format(a.notified_price)}` : ''}`
                        : 'Watching'}
                      {now && <> · now {usd.format(now.price)} at {now.storeName}</>}
                    </p>
                  </div>
                </Link>
                <button
                  type="button"
                  className="alert-remove"
                  onClick={() => onRemove(a.game_id)}
                  disabled={removing === a.game_id}
                  aria-label={`Remove the alert for ${a.game_name}`}
                  title="Remove alert"
                  data-testid="alert-remove"
                >
                  <CloseIcon />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
