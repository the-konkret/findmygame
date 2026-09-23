import { useEffect } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import SearchPage from './pages/SearchPage';
import GamePage from './pages/GamePage';
import LoginPage from './pages/LoginPage';
import FavouritesPage from './pages/FavouritesPage';
import { useAuth } from './auth/AuthProvider';

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
        <UserMenu />
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/game/:id" element={<GamePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/favourites" element={<FavouritesPage />} />
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

function UserMenu() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) return null;

  if (!user) {
    return (
      <nav className="nav">
        <NavLink to="/login" className="nav-link" data-testid="nav-login">Log in</NavLink>
      </nav>
    );
  }

  return (
    <nav className="nav">
      <NavLink to="/favourites" className="nav-link" data-testid="nav-favourites">★ My favourites</NavLink>
      <span className="nav-user" title={user.email ?? ''} data-testid="nav-user">{user.email}</span>
      <button
        type="button"
        className="btn-ghost"
        onClick={async () => {
          await signOut();
          navigate('/');
        }}
        data-testid="nav-logout"
      >
        Log out
      </button>
    </nav>
  );
}
