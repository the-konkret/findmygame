import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { checkAlerts, deleteAlert, onAlertsChanged, type PriceAlert } from '../api/priceAlerts';
import type { BestPrice } from '../api/cheapshark';
import LoadingImage from '../components/LoadingImage';
import { formatDay, usd } from '../lib/format';

/** Every game you've set a price alert on, with your price, today's price and whether it's been reached. */
export default function AlertsPage() {
  const { user, loading } = useAuth();
  const [alerts, setAlerts] = useState<PriceAlert[] | null>(null);
  const [prices, setPrices] = useState<Map<string, BestPrice>>(new Map());
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<number | null>(null);

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
      <h1 className="page-title">Alerts</h1>

      {error && <p className="status error" data-testid="alerts-error">{error}</p>}
      {!error && alerts === null && <p className="status">Loading…</p>}
      {alerts?.length === 0 && (
        <p className="status" data-testid="alerts-empty">
          No price alerts yet. <Link to="/">Find a game</Link>, then use “Notify me when the price drops” in its
          Deals box.
        </p>
      )}

      {alerts && alerts.length > 0 && (
        <div className="grid" data-testid="alerts-list">
          {alerts.map((a) => {
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
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
