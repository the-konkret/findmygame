import { Link } from 'react-router-dom';
import type { GameSummary } from '../api/rawg';
import LoadingImage from './LoadingImage';
import { StarIcon } from './Icons';

interface Props {
  game: GameSummary;
  isFavourite?: boolean;
  /** An extra line under the details, e.g. the AI search's reason why this game matches. */
  note?: string;
}

export default function GameCard({ game, isFavourite = false, note }: Props) {
  const year = game.released ? game.released.slice(0, 4) : 'TBA';
  const platforms = (game.parent_platforms ?? []).map((p) => p.platform.name).join(' · ');

  return (
    <Link to={`/game/${game.id}`} className="card" data-testid="game-card">
      <div className="card-image">
        {game.background_image ? (
          <LoadingImage src={game.background_image} alt={game.name} />
        ) : (
          <div className="card-image-empty">No image</div>
        )}
        {isFavourite && (
          <span className="badge-fav" title="In your favourites" aria-label="In your favourites" data-testid="favourite-badge">
            <StarIcon size={14} />
          </span>
        )}
        {game.metacritic != null && (
          <span className="badge-score" title="Metacritic">{game.metacritic}</span>
        )}
      </div>
      <div className="card-body">
        <h3 className="card-title" data-testid="game-card-title">{game.name}</h3>
        <p className="card-meta">{year}</p>
        {platforms && <p className="card-platforms">{platforms}</p>}
        {note && <p className="card-note" data-testid="game-card-note">{note}</p>}
      </div>
    </Link>
  );
}
