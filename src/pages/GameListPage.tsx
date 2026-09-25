import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { gameLists, type FavouriteGame, type GameListName } from '../api/userData';
import { findGameId, getBestPrices, type BestPrice } from '../api/cheapshark';
import { getSteamAppId } from '../api/rawg';
import LoadingImage from '../components/LoadingImage';
import SortSelect, { useSavedSort, type SortOption } from '../components/SortSelect';
import { usd } from '../lib/format';

interface Props {
  list: GameListName;
  title: string;
  path: string;
  /** shown when the list is empty */
  empty: ReactNode;
  /** prefix for the test ids, e.g. "favourite" → favourite-card, favourites-list, favourites-empty */
  testId: string;
}

type SortKey = 'recent' | 'oldest' | 'name' | 'released-new' | 'released-old' | 'cheapest';

const SORTS: SortOption<SortKey>[] = [
  { key: 'recent', label: 'Recently added' },
  { key: 'oldest', label: 'Oldest added' },
  { key: 'name', label: 'Name (A–Z)' },
  { key: 'released-new', label: 'Release date (newest)' },
  { key: 'released-old', label: 'Release date (oldest)' },
  { key: 'cheapest', label: 'Cheapest now' },
];

/** A page listing the games in one of your lists (My favourites, Wishlist). */
export default function GameListPage({ list, title, path, empty, testId }: Props) {
  const { user, loading } = useAuth();
  const [games, setGames] = useState<FavouriteGame[] | null>(null);
  const [error, setError] = useState('');
  const [sort, setSort] = useSavedSort<SortKey>(list, SORTS, 'recent');
  // Today's best PC price per game, looked up only when sorting by price.
  const [prices, setPrices] = useState<Map<number, BestPrice | null> | null>(null);
  const [pricesLoading, setPricesLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setGames(null);
    gameLists[list].list().then(setGames).catch((e: Error) => setError(e.message));
  }, [user, list]);

  useEffect(() => {
    if (sort !== 'cheapest' || !games || games.length === 0) return;
    const missing = games.filter((g) => !prices?.has(g.game_id));
    if (missing.length === 0) return;
    const controller = new AbortController();
    setPricesLoading(true);
    lookUpPrices(missing, controller.signal)
      .then((found) => setPrices((old) => new Map([...(old ?? []), ...found])))
      .catch(() => {
        /* no prices: the list simply keeps its order */
      })
      .finally(() => setPricesLoading(false));
    return () => controller.abort();
  }, [sort, games]);

  const sorted = useMemo(() => (games ? sortGames(games, sort, prices) : null), [games, sort, prices]);

  if (loading) return <p className="status">Loading…</p>;
  if (!user) return <Navigate to="/login" state={{ from: path }} replace />;

  return (
    <section>
      <div className="list-header">
        <h1 className="page-title">{title}</h1>
        {games && games.length > 1 && (
          <SortSelect value={sort} options={SORTS} onChange={setSort} testId={`${testId}s-sort`} />
        )}
      </div>

      {error && <p className="status error" data-testid={`${testId}s-error`}>{error}</p>}
      {!error && games === null && <p className="status">Loading…</p>}
      {games?.length === 0 && (
        <p className="status" data-testid={`${testId}s-empty`}>{empty}</p>
      )}
      {sort === 'cheapest' && pricesLoading && <p className="muted small list-note">Checking today's prices…</p>}

      {sorted && sorted.length > 0 && (
        <div className="grid" data-testid={`${testId}s-list`}>
          {sorted.map((g) => {
            const price = prices?.get(g.game_id);
            return (
              <Link key={g.game_id} to={`/game/${g.game_id}`} className="card" data-testid={`${testId}-card`}>
                <div className="card-image">
                  {g.game_image ? (
                    <LoadingImage src={g.game_image} alt={g.game_name} />
                  ) : (
                    <div className="card-image-empty">No image</div>
                  )}
                </div>
                <div className="card-body">
                  <h3 className="card-title" data-testid={`${testId}-card-title`}>{g.game_name}</h3>
                  <p className="card-meta">{g.released ? g.released.slice(0, 4) : 'TBA'}</p>
                  {sort === 'cheapest' && prices?.has(g.game_id) && (
                    <p className="card-platforms" data-testid={`${testId}-card-price`}>
                      {price ? `${usd.format(price.price)} at ${price.storeName}` : 'No PC store price'}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function sortGames(games: FavouriteGame[], sort: SortKey, prices: Map<number, BestPrice | null> | null): FavouriteGame[] {
  const list = [...games];
  const byName = (a: FavouriteGame, b: FavouriteGame) => a.game_name.localeCompare(b.game_name, 'en', { sensitivity: 'base' });
  switch (sort) {
    case 'recent':
      return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    case 'oldest':
      return list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    case 'name':
      return list.sort(byName);
    case 'released-new':
    case 'released-old': {
      const dir = sort === 'released-new' ? -1 : 1;
      // Unreleased / unknown dates always go last.
      return list.sort((a, b) => {
        if (!a.released || !b.released) return (a.released ? 0 : 1) - (b.released ? 0 : 1) || byName(a, b);
        return dir * a.released.localeCompare(b.released) || byName(a, b);
      });
    }
    case 'cheapest':
      // Games without a PC price (or not looked up yet) go last.
      return list.sort((a, b) => {
        const pa = prices?.get(a.game_id)?.price ?? Infinity;
        const pb = prices?.get(b.game_id)?.price ?? Infinity;
        return pa - pb || byName(a, b);
      });
  }
}

/**
 * Today's best PC price for each game: find each on CheapShark (remembered for a week), then one
 * batch price lookup. A few at a time, to go easy on RAWG and CheapShark.
 */
async function lookUpPrices(games: FavouriteGame[], signal: AbortSignal): Promise<Map<number, BestPrice | null>> {
  const csIds = new Map<number, string | null>();
  const queue = [...games];
  async function worker() {
    for (let g = queue.shift(); g; g = queue.shift()) {
      if (signal.aborted) return;
      const steamAppId = await getSteamAppId(String(g.game_id), signal).catch(() => null);
      const id = await findGameId(g.game_name, steamAppId, signal).catch(() => null);
      csIds.set(g.game_id, id);
    }
  }
  await Promise.all([worker(), worker(), worker()]);

  const ids = [...csIds.values()].filter((x): x is string => !!x);
  const best = ids.length ? await getBestPrices(ids, signal) : new Map<string, BestPrice>();
  const result = new Map<number, BestPrice | null>();
  for (const g of games) {
    const id = csIds.get(g.game_id);
    result.set(g.game_id, (id && best.get(id)) || null);
  }
  return result;
}
