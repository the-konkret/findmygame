import { Link, useLocation } from 'react-router-dom';
import type { GameRef } from '../api/userData';
import { useGameListToggle } from '../hooks/useGameListToggle';
import { StarIcon } from './Icons';

/** A round star in the top-right corner of the game picture: filled = in your favourites. */
export default function FavouriteButton({ game }: { game: GameRef }) {
  const { user, pending, inList, saving, error, toggle } = useGameListToggle('favourites', game);
  const location = useLocation();

  if (pending) {
    return <span className="fav-star pending" aria-busy="true" aria-label="Checking favourites" data-testid="favourite-pending" />;
  }

  if (!user) {
    return (
      <Link
        to="/login"
        state={{ from: location.pathname }}
        className="fav-star"
        aria-label="Log in to add to favourites"
        title="Log in to add to favourites"
        data-testid="favourite-login"
      >
        <StarIcon filled={false} size={22} />
      </Link>
    );
  }

  const label = inList ? 'Remove from favourites' : 'Add to favourites';
  return (
    <>
      <button
        type="button"
        className={`fav-star ${inList ? 'active' : ''}`}
        onClick={toggle}
        aria-pressed={inList}
        aria-busy={saving}
        aria-label={label}
        title={label}
        data-testid="favourite-button"
      >
        <StarIcon filled={inList} size={22} />
      </button>
      {error && <span className="fav-star-error error-text small" data-testid="favourite-error">{error}</span>}
    </>
  );
}
