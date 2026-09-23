import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import SearchPage from './pages/SearchPage';
import GamePage from './pages/GamePage';
import LoginPage from './pages/LoginPage';
import FavouritesPage from './pages/FavouritesPage';
import AccountPage from './pages/AccountPage';
import { useAuth } from './auth/AuthProvider';
import SearchBox from './components/SearchBox';
import { CogIcon, StarIcon } from './components/Icons';

export default function App() {
  const { pathname } = useLocation();
  // Start each new page at the top (otherwise a game opened from far down the results starts scrolled).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand" data-testid="brand-link" aria-label="FindMyGame home">
          <span className="brand-mark">◉</span> FindMy<span className="brand-accent">Game</span>
        </Link>
        {/* The home page has its own big search box; every other page gets one in the top bar.
            key={pathname} empties it whenever you move to another page. */}
        {pathname !== '/' && <HeaderSearch key={pathname} hideOnPhone={pathname === '/login'} />}
        <UserMenu />
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/game/:id" element={<GamePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/favourites" element={<FavouritesPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="*" element={<p className="status">Page not found. <Link to="/">Go to search</Link></p>} />
        </Routes>
      </main>

      <footer className="footer">
        Game data and images by{' '}
        <a href="https://rawg.io" target="_blank" rel="noreferrer" data-testid="rawg-attribution">
          RAWG
        </a>
        {' · '}Prices by{' '}
        <a href="https://www.cheapshark.com" target="_blank" rel="noreferrer">
          CheapShark
        </a>
      </footer>
    </div>
  );
}

/** hideOnPhone: on small screens, leave it out (the log-in page doesn't need it and space is tight). */
function HeaderSearch({ hideOnPhone = false }: { hideOnPhone?: boolean }) {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={`topbar-search ${hideOnPhone ? 'hide-on-phone' : ''}`} data-testid="header-search">
      <SearchBox
        compact
        value={value}
        onChange={setValue}
        // Enter / "Show all results" opens the home page with the full results.
        onSubmit={(term) => {
          if (term) navigate(`/?q=${encodeURIComponent(term)}`);
        }}
        inputRef={inputRef}
      />
    </div>
  );
}

function UserMenu() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <nav className="nav">
        <NavLink to="/login" className="nav-link" data-testid="nav-login">Log in</NavLink>
      </nav>
    );
  }

  // Logged in: favourites, and a link to the account page (picture, email, log out):
  // your profile picture if you've uploaded one, otherwise a cog.
  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null;

  return (
    <nav className="nav">
      <NavLink to="/favourites" className="nav-link nav-favourites" aria-label="My favourites" data-testid="nav-favourites">
        <StarIcon size={16} />
        <span className="nav-label">My favourites</span>
      </NavLink>
      <NavLink
        to="/account"
        className={`nav-icon ${avatarUrl ? 'nav-avatar' : 'nav-cog'}`}
        aria-label="Account settings"
        title="Account settings"
        data-testid="nav-account"
      >
        {avatarUrl ? <NavAvatar key={avatarUrl} src={avatarUrl} /> : <CogIcon />}
      </NavLink>
    </nav>
  );
}

/** Your profile picture in the top bar. If it can't be loaded, show the cog instead. */
function NavAvatar({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <CogIcon />;
  return <img src={src} alt="" className="nav-avatar-img" onError={() => setFailed(true)} data-testid="nav-avatar" />;
}
