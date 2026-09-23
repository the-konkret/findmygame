import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRandomGame } from '../api/rawg';

/** "Surprise me": opens the page of a random popular game. */
export default function SurpriseButton() {
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
    <div className="surprise">
      <button type="button" className="btn-surprise" onClick={surprise} disabled={busy} data-testid="surprise-button">
        <span className="surprise-die" aria-hidden>⚄</span>
        {busy ? 'Rolling…' : 'Surprise me'}
      </button>
      {error && <p className="error-text small" data-testid="surprise-error">{error}</p>}
    </div>
  );
}
