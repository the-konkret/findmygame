import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { gameLists, type FavouriteGame, type GameListName } from '../api/userData';
import LoadingImage from '../components/LoadingImage';

interface Props {
  list: GameListName;
  title: string;
  path: string;
  /** shown when the list is empty */
  empty: ReactNode;
  /** prefix for the test ids, e.g. "favourite" → favourite-card, favourites-list, favourites-empty */
  testId: string;
}

/** A page listing the games in one of your lists (My favourites, Wishlist). */
export default function GameListPage({ list, title, path, empty, testId }: Props) {
  const { user, loading } = useAuth();
  const [games, setGames] = useState<FavouriteGame[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    setGames(null);
    gameLists[list].list().then(setGames).catch((e: Error) => setError(e.message));
  }, [user, list]);

  if (loading) return <p className="status">Loading…</p>;
  if (!user) return <Navigate to="/login" state={{ from: path }} replace />;

  return (
    <section>
      <h1 className="page-title">{title}</h1>

      {error && <p className="status error" data-testid={`${testId}s-error`}>{error}</p>}
      {!error && games === null && <p className="status">Loading…</p>}
      {games?.length === 0 && (
        <p className="status" data-testid={`${testId}s-empty`}>{empty}</p>
      )}

      {games && games.length > 0 && (
        <div className="grid" data-testid={`${testId}s-list`}>
          {games.map((g) => (
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
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
