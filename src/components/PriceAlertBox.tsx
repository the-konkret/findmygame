import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { deleteAlert, getAlert, onAlertsChanged, parsePrice, saveAlert, type PriceAlert } from '../api/priceAlerts';
import type { GameRef } from '../api/userData';
import { formatDay, usd } from '../lib/format';
import { BellIcon } from './Icons';

interface Props {
  game: GameRef;
  cheapsharkId: string;
  bestPrice: number;
}

/** "Notify me when this game costs $X or less", under the store prices in the Deals box. */
export default function PriceAlertBox({ game, cheapsharkId, bestPrice }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [alert, setAlert] = useState<PriceAlert | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = () =>
      getAlert(game.id)
        .then((a) => {
          if (!active) return;
          setAlert(a);
          setState('ready');
        })
        .catch((e: Error) => {
          if (!active) return;
          setError(e.message);
          setState('error');
        });
    setState('loading');
    setEditing(false);
    load();
    // The bell may turn this alert into a notification, or remove it: keep this box in step.
    const stop = onAlertsChanged(load);
    return () => {
      active = false;
      stop();
    };
  }, [user, game.id]);

  if (loading) return null;

  if (!user) {
    return (
      <div className="price-alert" data-testid="price-alert">
        <p className="muted price-alert-text">
          <BellIcon size={16} />{' '}
          <Link to="/login" state={{ from: location.pathname }} data-testid="price-alert-login">Log in</Link> to get
          notified when the price drops.
        </p>
      </div>
    );
  }

  if (state === 'loading') {
    return <div className="price-alert" data-testid="price-alert"><p className="muted">&nbsp;</p></div>;
  }

  function startEditing() {
    let suggestion = Math.floor(bestPrice * 0.75) - 0.01; // e.g. $19.99 → $13.99
    if (suggestion <= 0) suggestion = Math.floor(bestPrice * 50) / 100; // very cheap games: half price
    if (alert && !alert.notified_at) suggestion = alert.target_price;
    setInput(suggestion > 0 ? suggestion.toFixed(2) : '');
    setError('');
    setEditing(true);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const price = parsePrice(input);
    if (price == null) {
      setError('Type a price in dollars, e.g. 9.99');
      return;
    }
    if (price >= bestPrice) {
      setError(`It's already ${usd.format(bestPrice)}. Pick a price below that.`);
      return;
    }
    setState('saving');
    setError('');
    try {
      setAlert(await saveAlert(game, cheapsharkId, price));
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setState('ready');
    }
  }

  async function onRemove() {
    setState('saving');
    setError('');
    try {
      await deleteAlert(game.id);
      setAlert(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setState('ready');
    }
  }

  const busy = state === 'saving';

  if (editing) {
    return (
      <form className="price-alert" onSubmit={onSave} data-testid="price-alert">
        <label className="price-alert-label" htmlFor="price-alert-input">
          <BellIcon size={16} /> Notify me when it costs
        </label>
        <div className="price-alert-row">
          <span className="price-alert-field">
            <span aria-hidden="true">$</span>
            <input
              id="price-alert-input"
              inputMode="decimal"
              autoComplete="off"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Target price in US dollars"
              data-testid="price-alert-input"
              autoFocus
            />
          </span>
          <span className="muted">or less</span>
        </div>
        <div className="price-alert-row">
          <button type="submit" className="btn-primary" disabled={busy} data-testid="price-alert-save">
            {busy ? 'Saving…' : 'Set alert'}
          </button>
          <button type="button" className="btn-ghost" onClick={() => setEditing(false)} disabled={busy}>
            Cancel
          </button>
        </div>
        {error && <p className="error-text" data-testid="price-alert-error">{error}</p>}
      </form>
    );
  }

  return (
    <div className="price-alert" data-testid="price-alert">
      {state === 'error' && <p className="error-text" data-testid="price-alert-error">{error}</p>}

      {state !== 'error' && !alert && (
        <button type="button" className="btn-ghost btn-alert" onClick={startEditing} data-testid="price-alert-open">
          <BellIcon size={16} /> Notify me when the price drops
        </button>
      )}

      {alert && !alert.notified_at && (
        <p className="price-alert-text" data-testid="price-alert-status">
          <BellIcon size={16} /> Watching for <strong data-testid="price-alert-target">{usd.format(alert.target_price)}</strong>{' '}
          or less. You'll get a notification under the bell when it gets there.
        </p>
      )}

      {alert?.notified_at && (
        <p className="price-alert-text" data-testid="price-alert-status">
          <BellIcon size={16} /> Reached your price on {formatDay(alert.notified_at)}
          {alert.notified_price != null && <>: <strong>{usd.format(alert.notified_price)}</strong></>}
          {alert.notified_store && ` at ${alert.notified_store}`}.
        </p>
      )}

      {alert && (
        <div className="price-alert-row">
          <button type="button" className="btn-ghost" onClick={startEditing} disabled={busy} data-testid="price-alert-edit">
            {alert.notified_at ? 'Set a new price' : 'Change price'}
          </button>
          <button type="button" className="btn-ghost" onClick={onRemove} disabled={busy} data-testid="price-alert-remove">
            {busy ? 'Removing…' : 'Remove alert'}
          </button>
        </div>
      )}
      {state !== 'error' && error && <p className="error-text" data-testid="price-alert-error">{error}</p>}
    </div>
  );
}
