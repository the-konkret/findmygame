import { Link, Route, Routes } from 'react-router-dom';
import SearchPage from './pages/SearchPage';
import GamePage from './pages/GamePage';

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand" data-testid="brand-link">
          <span className="brand-mark">◉</span> FindMy<span className="brand-accent">Game</span>
        </Link>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/game/:id" element={<GamePage />} />
        </Routes>
      </main>

      <footer className="footer">
        Game data and images by{' '}
        <a href="https://rawg.io" target="_blank" rel="noreferrer" data-testid="rawg-attribution">
          RAWG
        </a>
      </footer>
    </div>
  );
}
