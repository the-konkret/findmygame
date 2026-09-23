import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { addFavourite, isFavourite, peekFavourite, removeFavourite, type GameRef } from '../api/userData';

export default function FavouriteButton({ game }: { game: GameRef }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  // Use the remembered answer if there is one, so the button is right from the very first frame.
  const [fav, setFav] = useState<boolean | null>(() => (user ? peekFavourite(user.id, game.id) ?? null : null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const known = peekFavourite(user.id, game.id);
    if (known !== undefined) {
      setFav(known);
      return;
    }
    let active = true;
    setFav(null);
    isFavourite(user.id, game.id)
      .then((v) => active && setFav(v))
      .catch((e: Error) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [user, game.id]);

  // Still finding out (who is logged in, or whether this game is a favourite):
  // show an empty placeholder of the same size instead of a guess that might flip a moment later.
  if (loading || (user && fav === null && !error)) {
    return (
      <div className="fav-wrap">
        <span className="btn-fav pending" aria-busy="true" aria-label="Checking favourites" data-testid="favourite-pending" />
      </div>
    );
  }

  if (!user) {
    return (
      <Link to="/login" state={{ from: location.pathname }} className="btn-fav" data-testid="favourite-login">
        ☆ Log in to add to favourites
      </Link>
    );
  }

  async function toggle() {
    if (!user) return;
    setBusy(true);
    setError('');
    try {
      if (fav) await removeFavourite(user.id, game.id);
      else await addFavourite(user.id, game);
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
