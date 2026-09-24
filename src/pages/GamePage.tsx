import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getGame, type GameDetails } from '../api/rawg';
import { favourites, wishlist } from '../api/userData';
import { useAuth } from '../auth/AuthProvider';
import DealsPanel from '../components/DealsPanel';
import FavouriteButton from '../components/FavouriteButton';
import WishlistButton from '../components/WishlistButton';
import NotesPanel from '../components/NotesPanel';
import LoadingImage from '../components/LoadingImage';

export default function GamePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<GameDetails | null>(null);
  const [error, setError] = useState('');
  const { user } = useAuth();

  // Ask for your favourites and wishlist at the same time as the game details, so they're ready when the page shows.
  useEffect(() => {
    if (!user) return;
    favourites.prefetch(user.id);
    wishlist.prefetch(user.id);
  }, [user]);

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

  if (!game) return <GamePageSkeleton />;

  const names = (list?: { name: string }[]) => (list ?? []).map((x) => x.name).join(', ');
  const platforms = (game.platforms ?? []).map((p) => p.platform.name).join(', ');
  const stores = (game.stores ?? []).map((s) => s.store.name).join(', ');

  return (
    <section className="game-page" data-testid="game-page">
      <div className="game-hero">
        {game.background_image && (
          <LoadingImage key={game.id} src={game.background_image} alt="" loading="eager" fallback="" className="game-hero-img" />
        )}
        {/* favourite star in the top-right corner of the picture */}
        <div className="game-hero-corner">
          <FavouriteButton game={game} />
        </div>
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
            {game.released && <span className="pill" data-testid="game-released">Released {formatDate(game.released)}</span>}
            {game.playtime > 0 && <span className="pill">~{game.playtime} h avg playtime</span>}
          </div>
          <WishlistButton game={game} />
        </div>
      </div>

      <div className="game-body">
        <div className="game-main">
          <NotesPanel game={game} />

          <article className="panel game-description">
            <h2>About</h2>
            <p data-testid="game-description">{game.description_raw || 'No description available.'}</p>
          </article>
        </div>

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

/** Shown while the game details load: grey shapes where the picture, title and panels will be. */
function GamePageSkeleton() {
  return (
    <section className="game-page" data-testid="game-loading" aria-busy="true" aria-label="Loading game">
      <div className="game-hero skeleton">
        <div className="game-hero-shade skeleton-shade">
          <span className="sk-line" style={{ width: 70, height: 30 }} />
          <div>
            <span className="sk-line" style={{ width: 'min(420px, 70%)', height: 38, marginBottom: 14 }} />
            <span className="sk-line" style={{ width: 'min(300px, 55%)', height: 24 }} />
          </div>
        </div>
      </div>
      <div className="game-body">
        <div className="game-main">
          <div className="panel sk-panel">
            <span className="sk-line" style={{ width: 90 }} />
            <span className="sk-line" />
            <span className="sk-line" />
            <span className="sk-line" style={{ width: '60%' }} />
          </div>
        </div>
        <div className="game-sidebar">
          <div className="panel sk-panel">
            <span className="sk-line" style={{ width: 70 }} />
            <span className="sk-line" style={{ width: 120, height: 30 }} />
            <span className="sk-line" />
          </div>
        </div>
      </div>
    </section>
  );
}

/** RAWG gives dates as 2015-05-18; show them as 18.05.2015. */
function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return day && month && year ? `${day}.${month}.${year}` : isoDate;
}
