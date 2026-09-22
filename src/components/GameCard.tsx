import { Link } from 'react-router-dom';
import type { GameSummary } from '../api/rawg';

export default function GameCard({ game }: { game: GameSummary }) {
  const year = game.released ? game.released.slice(0, 4) : 'TBA';
  const platforms = (game.parent_platforms ?? []).map((p) => p.platform.name).join(' · ');

  return (
    <Link to={`/game/${game.id}`} className="card" data-testid="game-card">
      <div className="card-image">
        {game.background_image ? (
          <img src={game.background_image} alt={game.name} loading="lazy" />
        ) : (
          <div className="card-image-empty">No image</div>
        )}
        {game.metacritic != null && (
          <span className="badge-score" title="Metacritic">{game.metacritic}</span>
        )}
      </div>
      <div className="card-body">
        <h3 className="card-title" data-testid="game-card-title">{game.name}</h3>
        <p className="card-meta">{year}</p>
        {platforms && <p className="card-platforms">{platforms}</p>}
      </div>
    </Link>
  );
}
