import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRandomGame } from '../api/rawg';
import { DiceIcon } from './Icons';

/** "Surprise me": opens the page of a random popular game.
 * compact: the smaller version next to the search box in the top bar (just the die on narrow screens). */
export default function SurpriseButton({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function surprise() {
    setBusy(true);
    setError('');
    try {
      const game = await getRandomGame();
      navigate(`/game/${game.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className={`surprise ${compact ? 'compact' : ''}`}>
      <button
        type="button"
        className="btn-surprise"
        onClick={surprise}
        disabled={busy}
        aria-label="Surprise me: open a random game"
        title={compact ? 'Surprise me' : undefined}
        data-testid="surprise-button"
      >
        <span className="surprise-die" aria-hidden><DiceIcon size={compact ? 20 : 24} /></span>
        <span className="surprise-label">{busy ? 'Rolling…' : 'Surprise me'}</span>
      </button>
      {error && <p className="error-text small" data-testid="surprise-error">{error}</p>}
    </div>
  );
}
