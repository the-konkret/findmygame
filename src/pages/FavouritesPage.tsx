import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { listFavourites, type FavouriteGame } from '../api/userData';

export default function FavouritesPage() {
  const { user, loading } = useAuth();
  const [games, setGames] = useState<FavouriteGame[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    listFavourites().then(setGames).catch((e: Error) => setError(e.message));
  }, [user]);

  if (loading) return <p className="status">Loading…</p>;
  if (!user) return <Navigate to="/login" state={{ from: '/favourites' }} replace />;

  return (
    <section>
      <h1 className="page-title">My favourites</h1>

      {error && <p className="status error" data-testid="favourites-error">{error}</p>}
      {!error && games === null && <p className="status">Loading your favourites…</p>}
      {games?.length === 0 && (
        <p className="status" data-testid="favourites-empty">
          No favourites yet. <Link to="/">Search for a game</Link> and click “Add to favourites”.
        </p>
      )}

      {games && games.length > 0 && (
        <div className="grid" data-testid="favourites-list">
          {games.map((g) => (
            <Link key={g.game_id} to={`/game/${g.game_id}`} className="card" data-testid="favourite-card">
              <div className="card-image">
                {g.game_image ? (
                  <img src={g.game_image} alt={g.game_name} loading="lazy" />
                ) : (
                  <div className="card-image-empty">No image</div>
                )}
              </div>
              <div className="card-body">
                <h3 className="card-title" data-testid="favourite-card-title">{g.game_name}</h3>
                <p className="card-meta">{g.released ? g.released.slice(0, 4) : 'TBA'}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
