import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import SearchPage from './pages/SearchPage';
import GamePage from './pages/GamePage';
import LoginPage from './pages/LoginPage';
import FavouritesPage from './pages/FavouritesPage';
import WishlistPage from './pages/WishlistPage';
import AlertsPage from './pages/AlertsPage';
import AccountPage from './pages/AccountPage';
import { useAuth } from './auth/AuthProvider';
import { recordPageView } from './api/analytics';
import StatsPage from './pages/StatsPage';
import RankingsPage from './pages/RankingsPage';
import NewsPage from './pages/NewsPage';
import SearchBox from './components/SearchBox';
import SurpriseButton from './components/SurpriseButton';
import AccountMenu from './components/AccountMenu';
import NotificationBell from './components/NotificationBell';
import MobileMenu from './components/MobileMenu';
import { BackIcon, CogIcon, GiftIcon, NewsIcon, StarIcon, TagIcon, TrophyIcon } from './components/Icons';

export default function App() {
  const { pathname } = useLocation();
  const { user, loading } = useAuth();
  // Count the visit (for /stats), once we know whether the visitor is logged in.
  useEffect(() => {
    if (!loading) recordPageView(pathname, user?.id ?? null);
  }, [pathname, loading, user?.id]);

  // Start each new page at the top (otherwise a game opened from far down the results starts scrolled).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="app">
      {/* signed-in: on very narrow phones the logo shows just its ring, to make room for the icons */}
      <header className={`topbar ${user ? 'signed-in' : ''}`}>
        <div className="topbar-left">
          {pathname !== '/' && <TopBarBack />}
          <Link to="/" className="brand" data-testid="brand-link" aria-label="FindMyGame home">
            <span className="brand-mark">◉</span>
            <span className="brand-text">FindMy<span className="brand-accent">Game</span></span>
          </Link>
        </div>
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
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/rankings" element={<RankingsPage />} />
          <Route path="/news" element={<NewsPage />} />
          {/* Not linked anywhere: visit statistics */}
          <Route path="/stats" element={<StatsPage />} />
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
      <SurpriseButton compact />
    </div>
  );
}

function UserMenu() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <nav className="nav">
        <RankingsLink />
        <NewsLink />
        <NavLink to="/login" className="nav-link desktop-only" data-testid="nav-login">Log in</NavLink>
        <MobileMenu />
      </nav>
    );
  }

  // Logged in: favourites, and a link to the account page (picture, email, log out):
  // your profile picture if you've uploaded one, otherwise a cog.
  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null;

  return (
    <nav className="nav">
      <RankingsLink />
      <NewsLink />
      <NavLink to="/favourites" className="nav-link nav-favourites desktop-only" aria-label="My favourites" data-testid="nav-favourites">
        <StarIcon size={16} />
        <span className="nav-label">My favourites</span>
      </NavLink>
      <NavLink to="/wishlist" className="nav-link nav-favourites desktop-only" aria-label="Wishlist" data-testid="nav-wishlist">
        <GiftIcon size={16} />
        <span className="nav-label">Wishlist</span>
      </NavLink>
      <NavLink to="/alerts" className="nav-link nav-favourites desktop-only" aria-label="Alerts" data-testid="nav-alerts">
        <TagIcon size={16} />
        <span className="nav-label">Alerts</span>
      </NavLink>
      <NotificationBell />
      <div className="desktop-only">
        <AccountMenu
          isAvatar={!!avatarUrl}
          icon={avatarUrl ? <NavAvatar key={avatarUrl} src={avatarUrl} /> : <CogIcon />}
        />
      </div>
      {/* phones: everything but the bell goes in here */}
      <MobileMenu />
    </nav>
  );
}

function NewsLink() {
  return (
    <NavLink to="/news" className="nav-link nav-favourites desktop-only" aria-label="News" data-testid="nav-news">
      <NewsIcon size={16} />
      <span className="nav-label">News</span>
    </NavLink>
  );
}

function RankingsLink() {
  return (
    <NavLink to="/rankings" className="nav-link nav-favourites desktop-only" aria-label="Rankings" data-testid="nav-rankings">
      <TrophyIcon size={16} />
      <span className="nav-label">Rankings</span>
    </NavLink>
  );
}

/** Your profile picture in the top bar. If it can't be loaded, show the cog instead. */
function NavAvatar({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <CogIcon />;
  return <img src={src} alt="" className="nav-avatar-img" onError={() => setFailed(true)} data-testid="nav-avatar" />;
}

/** Back arrow for phones: to the previous page, or home if this page was opened directly (e.g. from a link). */
function TopBarBack() {
  const navigate = useNavigate();
  const location = useLocation();
  const cameFromThisSite = location.key !== 'default';
  return (
    <button
      type="button"
      className="topbar-back"
      aria-label="Back"
      onClick={() => (cameFromThisSite ? navigate(-1) : navigate('/'))}
      data-testid="topbar-back"
    >
      <BackIcon />
    </button>
  );
}
