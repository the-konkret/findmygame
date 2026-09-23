import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { addFavourite, isFavourite, peekFavourite, removeFavourite, type GameRef } from '../api/userData';
import { StarIcon } from './Icons';

export default function FavouriteButton({ game }: { game: GameRef }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  // Use the remembered answer if there is one, so the button is right from the very first frame.
  const [fav, setFav] = useState<boolean | null>(() => (user ? peekFavourite(user.id, game.id) ?? null : null));
  const [saving, setSaving] = useState(false);
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
        <StarIcon filled={false} />
        <span>Log in to add to favourites</span>
      </Link>
    );
  }

  // Flip the button straight away and save in the background (no greyed-out "waiting" moment).
  // If saving fails, flip it back and say so.
  async function toggle() {
    if (!user || saving) return;
    const next = !fav;
    setFav(next);
    setSaving(true);
    setError('');
    try {
      if (next) await addFavourite(user.id, game);
      else await removeFavourite(user.id, game.id);
    } catch (e) {
      setFav(!next);
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fav-wrap">
      <button
        type="button"
        className={`btn-fav ${fav ? 'active' : ''}`}
        onClick={toggle}
        aria-pressed={!!fav}
        aria-busy={saving}
        data-testid="favourite-button"
      >
        <StarIcon filled={!!fav} />
        <span>{fav ? 'In favourites' : 'Add to favourites'}</span>
      </button>
      {error && <span className="error-text small" data-testid="favourite-error">{error}</span>}
    </div>
  );
}
