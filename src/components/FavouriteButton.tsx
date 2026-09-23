import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { addFavourite, isFavourite, removeFavourite, type GameRef } from '../api/userData';

export default function FavouriteButton({ game }: { game: GameRef }) {
  const { user } = useAuth();
  const location = useLocation();
  const [fav, setFav] = useState<boolean | null>(null); // null = still checking
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    let active = true;
    setFav(null);
    isFavourite(game.id)
      .then((v) => active && setFav(v))
      .catch((e: Error) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [user, game.id]);

  if (!user) {
    return (
      <Link to="/login" state={{ from: location.pathname }} className="btn-fav" data-testid="favourite-login">
        ☆ Log in to add to favourites
      </Link>
    );
  }

  async function toggle() {
    setBusy(true);
    setError('');
    try {
      if (fav) await removeFavourite(game.id);
      else await addFavourite(game);
      setFav(!fav);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fav-wrap">
      <button
        type="button"
        className={`btn-fav ${fav ? 'active' : ''}`}
        onClick={toggle}
        disabled={busy || fav === null}
        aria-pressed={!!fav}
        data-testid="favourite-button"
      >
        {fav ? '★ In favourites' : '☆ Add to favourites'}
      </button>
      {error && <span className="error-text small" data-testid="favourite-error">{error}</span>}
    </div>
  );
}
