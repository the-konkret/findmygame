import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getGame, type GameDetails } from '../api/rawg';
import { favourites, wishlist } from '../api/userData';
import { useAuth } from '../auth/AuthProvider';
import DealsPanel from '../components/DealsPanel';
import FavouriteButton from '../components/FavouriteButton';
import WishlistButton from '../components/WishlistButton';
import NotesPanel from '../components/NotesPanel';
import GameNews from '../components/GameNews';
import PlatformChips from '../components/PlatformChips';
import LoadingImage from '../components/LoadingImage';
import { BackIcon, NoteIcon } from '../components/Icons';

export default function GamePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<GameDetails | null>(null);
  const [error, setError] = useState('');
  const { user } = useAuth();
  // Notes: hidden until "Add a note" is clicked (or shown straight away if there's a saved note).
  const [notesOpen, setNotesOpen] = useState(false);
  const [hasNote, setHasNote] = useState(false);
  const [noteFocus, setNoteFocus] = useState(0);
  // Does the game have an "Official news" box? If not, Details moves up under Deals (null = still checking).
  const [newsFound, setNewsFound] = useState<boolean | null>(null);
  useEffect(() => {
    setNewsFound(null);
    setNotesOpen(false);
    setHasNote(false);
    setNoteFocus(0);
  }, [id]);

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
        <button className="btn-ghost btn-back" onClick={() => navigate(-1)}><BackIcon size={16} /> Back</button>
        <p className="status error" data-testid="game-error">{error}</p>
      </section>
    );
  }

  if (!game) return <GamePageSkeleton />;

  const names = (list?: { name: string }[]) => (list ?? []).map((x) => x.name).join(', ');
  const stores = (game.stores ?? []).map((s) => s.store.name).join(' · ');
  const developers = names(game.developers);
  const publishers = names(game.publishers);

  // Details: under About, or under Deals when the game has no news (keeps the two columns even).
  const details = (
    <aside className="panel game-facts" data-testid="game-facts">
      <h2>Details</h2>
      <dl>
        {game.platforms?.length ? (
          <Fact label="Platforms"><PlatformChips platforms={game.platforms} /></Fact>
        ) : null}
        {game.genres?.length ? <Fact label="Genres">{names(game.genres)}</Fact> : null}
        {/* one row when the same studio made and published it */}
        {developers && developers === publishers ? (
          <Fact label="Developer & publisher">{developers}</Fact>
        ) : (
          <>
            {developers && <Fact label="Developer">{developers}</Fact>}
            {publishers && <Fact label="Publisher">{publishers}</Fact>}
          </>
        )}
        {game.esrb_rating && <Fact label="Age rating">{game.esrb_rating.name}</Fact>}
        {stores && <Fact label="Available on">{stores}</Fact>}
      </dl>
      <div className="links">
        {game.website && (
          <a href={game.website} target="_blank" rel="noreferrer">Official website ↗</a>
        )}
        <a href={`https://rawg.io/games/${game.slug}`} target="_blank" rel="noreferrer">View on RAWG ↗</a>
      </div>
    </aside>
  );

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
          <button className="btn-ghost btn-back" onClick={() => navigate(-1)} data-testid="back-button">
            <BackIcon size={16} /> Back
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
          <div className="hero-actions">
            <WishlistButton game={game} />
            {user && (
              <button
                type="button"
                className="btn-fav"
                onClick={() => {
                  setNotesOpen(true);
                  setNoteFocus((n) => n + 1);
                }}
                data-testid="note-button"
              >
                <NoteIcon />
                <span>{hasNote ? 'Your note' : 'Add a note'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="game-body">
        <div className="game-main">
          <article className="panel game-description">
            <h2>About</h2>
            <p data-testid="game-description">{game.description_raw || 'No description available.'}</p>
          </article>

          {newsFound !== false && details}

          {/* Your note: shown after "Add a note", or straight away if you've written one */}
          <NotesPanel
            game={game}
            open={notesOpen}
            focusRequest={noteFocus}
            onHasNote={setHasNote}
            onClose={() => setNotesOpen(false)}
          />
        </div>

        <div className="game-sidebar">
          <DealsPanel gameId={id} game={game} />
          {newsFound === false && details}


          <GameNews gameId={id} onResult={setNewsFound} />
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

/** One label + value in the Details box. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** RAWG gives dates as 2015-05-18; show them as 18.05.2015. */
function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return day && month && year ? `${day}.${month}.${year}` : isoDate;
}
