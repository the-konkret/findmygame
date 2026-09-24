import { useEffect, useState } from 'react';
import { getSteamAppId } from '../api/rawg';
import { getGameDeals, type GameDeals } from '../api/cheapshark';
import type { GameRef } from '../api/userData';
import PriceAlertBox from './PriceAlertBox';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const monthYear = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' });

type State =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: GameDeals };

export default function DealsPanel({ gameId, game }: { gameId: string; game: GameRef }) {
  const gameName = game.name;
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0); // "Try again" bumps this, which re-runs the lookup

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: 'loading' });

    (async () => {
      // A missing Steam ID isn't fatal: we fall back to matching by title.
      const steamAppId = await getSteamAppId(gameId, controller.signal).catch(() => null);
      const data = await getGameDeals(gameName, steamAppId, controller.signal);
      if (!data || data.deals.length === 0) setState({ kind: 'not-found' });
      else setState({ kind: 'ready', data });
    })().catch((err: Error) => {
      if (err.name !== 'AbortError') setState({ kind: 'error', message: err.message });
    });

    return () => controller.abort();
  }, [gameId, gameName, attempt]);

  return (
    <aside className="panel deals" data-testid="deals-panel">
      <h2>Deals</h2>

      {state.kind === 'loading' && <p className="muted" data-testid="deals-loading">Checking store prices…</p>}

      {state.kind === 'error' && (
        <div className="deals-error">
          <p className="error-text" data-testid="deals-error">{state.message}</p>
          <button type="button" className="btn-ghost" onClick={() => setAttempt((n) => n + 1)} data-testid="deals-retry">
            Try again
          </button>
        </div>
      )}

      {state.kind === 'not-found' && (
        <p className="muted" data-testid="deals-none">
          No PC store prices found for this game. Console stores (PlayStation, Xbox, Nintendo) have no free
          price API, so they aren't covered.
        </p>
      )}

      {state.kind === 'ready' && (
        <>
          <DealsList data={state.data} />
          <PriceAlertBox game={game} cheapsharkId={state.data.cheapsharkId} bestPrice={state.data.deals[0].price} />
        </>
      )}

      <p className="deals-footnote">
        PC stores, prices in USD, via{' '}
        <a href="https://www.cheapshark.com" target="_blank" rel="noreferrer">CheapShark</a>
      </p>
    </aside>
  );
}

function DealsList({ data }: { data: GameDeals }) {
  const best = data.deals[0];
  const onSale = data.deals.filter((d) => d.savingsPercent > 0).length;

  return (
    <>
      <div className="deals-best" data-testid="deals-best">
        <span className="deals-best-price">{usd.format(best.price)}</span>
        <span className="deals-best-store">best price, at {best.storeName}</span>
        {best.savingsPercent > 0 && <span className="discount">-{best.savingsPercent}%</span>}
      </div>

      <p className="muted deals-summary" data-testid="deals-summary">
        {onSale > 0
          ? `On sale at ${onSale} of ${data.deals.length} ${data.deals.length === 1 ? 'store' : 'stores'}`
          : 'No discounts right now'}
        {data.lowestEver &&
          ` · lowest ever ${usd.format(data.lowestEver.price)} (${monthYear.format(data.lowestEver.date)})`}
      </p>

      <ul className="deals-list" data-testid="deals-list">
        {data.deals.map((d) => (
          <li key={d.storeId + d.url} className="deal" data-testid="deal-row">
            <a href={d.url} target="_blank" rel="noreferrer" title={`Open deal at ${d.storeName}`}>
              {d.storeIcon && <img src={d.storeIcon} alt="" className="deal-icon" />}
              <span className="deal-store" data-testid="deal-store">{d.storeName}</span>
              {d.savingsPercent > 0 && <span className="discount" data-testid="deal-discount">-{d.savingsPercent}%</span>}
              <span className="deal-prices">
                {d.savingsPercent > 0 && <s className="deal-retail">{usd.format(d.retailPrice)}</s>}
                <span className="deal-price" data-testid="deal-price">{usd.format(d.price)}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
