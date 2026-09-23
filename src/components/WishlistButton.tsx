import { Link, useLocation } from 'react-router-dom';
import type { GameRef } from '../api/userData';
import { useGameListToggle } from '../hooks/useGameListToggle';
import { GiftIcon } from './Icons';

/** "Add to wishlist" / "On your wishlist" button on the game page. */
export default function WishlistButton({ game }: { game: GameRef }) {
  const { user, pending, inList, saving, error, toggle } = useGameListToggle('wishlist', game);
  const location = useLocation();

  if (pending) {
    return (
      <div className="fav-wrap">
        <span className="btn-fav pending" aria-busy="true" aria-label="Checking wishlist" data-testid="wishlist-pending" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fav-wrap">
        <Link to="/login" state={{ from: location.pathname }} className="btn-fav" data-testid="wishlist-login">
          <GiftIcon />
          <span>Log in to add to wishlist</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="fav-wrap">
      <button
        type="button"
        className={`btn-fav ${inList ? 'active' : ''}`}
        onClick={toggle}
        aria-pressed={inList}
        aria-busy={saving}
        data-testid="wishlist-button"
      >
        <GiftIcon />
        <span>{inList ? 'On your wishlist' : 'Add to wishlist'}</span>
      </button>
      {error && <span className="error-text small" data-testid="wishlist-error">{error}</span>}
    </div>
  );
}
