import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getGame, type GameDetails } from '../api/rawg';
import DealsPanel from '../components/DealsPanel';

export default function GamePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<GameDetails | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setGame(null);
    setError('');
    getGame(id, controller.signal)
      .then(setGame)
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setError(err.message);
      });
    return () => controller.abort();
  }, [id]);

  if (error) {
    return (
      <section className="game-page">
        <button className="btn-ghost" onClick={() => navigate(-1)}>← Back</button>
        <p className="status error" data-testid="game-error">{error}</p>
      </section>
    );
  }

  if (!game) return <p className="status" data-testid="game-loading">Loading game…</p>;

  const names = (list?: { name: string }[]) => (list ?? []).map((x) => x.name).join(', ');
  const platforms = (game.platforms ?? []).map((p) => p.platform.name).join(', ');
  const stores = (game.stores ?? []).map((s) => s.store.name).join(', ');

  return (
    <section className="game-page" data-testid="game-page">
      <div
        className="game-hero"
        style={game.background_image ? { backgroundImage: `url(${game.background_image})` } : undefined}
      >
        <div className="game-hero-shade">
          <button className="btn-ghost" onClick={() => navigate(-1)} data-testid="back-button">
            ← Back
          </button>
          <h1 className="game-title" data-testid="game-title">{game.name}</h1>
          <div className="game-badges">
            {game.metacritic != null && (
              <span className="pill pill-accent" data-testid="game-metacritic">Metacritic {game.metacritic}</span>
            )}
            {game.rating > 0 && <span className="pill">★ {game.rating.toFixed(2)} / 5</span>}
            {game.released && <span className="pill">Released {game.released}</span>}
            {game.playtime > 0 && <span className="pill">~{game.playtime} h avg playtime</span>}
          </div>
        </div>
      </div>

      <div className="game-body">
        <article className="panel game-description">
          <h2>About</h2>
          <p data-testid="game-description">{game.description_raw || 'No description available.'}</p>
        </article>

        <div className="game-sidebar">
          <DealsPanel gameId={id} gameName={game.name} />

          <aside className="panel game-facts" data-testid="game-facts">
            <h2>Details</h2>
            <dl>
              {platforms && (<><dt>Platforms</dt><dd>{platforms}</dd></>)}
              {game.genres?.length ? (<><dt>Genres</dt><dd>{names(game.genres)}</dd></>) : null}
              {game.developers?.length ? (<><dt>Developer</dt><dd>{names(game.developers)}</dd></>) : null}
              {game.publishers?.length ? (<><dt>Publisher</dt><dd>{names(game.publishers)}</dd></>) : null}
              {stores && (<><dt>Available on</dt><dd>{stores}</dd></>)}
              {game.esrb_rating && (<><dt>Age rating</dt><dd>{game.esrb_rating.name}</dd></>)}
            </dl>
            <div className="links">
              {game.website && (
                <a href={game.website} target="_blank" rel="noreferrer">Official website ↗</a>
              )}
              <a href={`https://rawg.io/games/${game.slug}`} target="_blank" rel="noreferrer">View on RAWG ↗</a>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
