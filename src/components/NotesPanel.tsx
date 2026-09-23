import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { getNote, saveNote, type GameRef } from '../api/userData';

const MAX_LENGTH = 5000;
const savedAt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

type Status = 'loading' | 'idle' | 'saving' | 'saved' | 'error';

export default function NotesPanel({ game }: { game: GameRef }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [text, setText] = useState('');
  const [savedText, setSavedText] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    let active = true;
    setStatus('loading');
    getNote(game.id)
      .then((note) => {
        if (!active) return;
        setText(note?.body ?? '');
        setSavedText(note?.body ?? '');
        setUpdatedAt(note ? new Date(note.updated_at) : null);
        setStatus('idle');
      })
      .catch((e: Error) => {
        if (!active) return;
        setError(e.message);
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [user, game.id]);

  // Don't flash "Log in" while the saved login is still being read.
  if (loading) {
    return (
      <section className="panel notes" data-testid="notes-panel">
        <h2>My notes</h2>
        <p className="muted">&nbsp;</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="panel notes" data-testid="notes-panel">
        <h2>My notes</h2>
        <p className="muted">
          <Link to="/login" state={{ from: location.pathname }} data-testid="notes-login">Log in</Link> to keep
          private notes about this game.
        </p>
      </section>
    );
  }

  const dirty = text.trim() !== savedText.trim();

  async function onSave() {
    setStatus('saving');
    setError('');
    try {
      await saveNote(game, text);
      const clean = text.trim();
      setText(clean);
      setSavedText(clean);
      setUpdatedAt(clean ? new Date() : null);
      setStatus('saved');
    } catch (e) {
      setError((e as Error).message);
      setStatus('error');
    }
  }

  return (
    <section className="panel notes" data-testid="notes-panel">
      <h2>My notes</h2>
      <textarea
        className="notes-input"
        placeholder="Anything to remember: where you left off, what to try next, a price you're waiting for…"
        value={text}
        maxLength={MAX_LENGTH}
        disabled={status === 'loading'}
        onChange={(e) => {
          setText(e.target.value);
          if (status === 'saved') setStatus('idle');
        }}
        aria-label="Note about this game"
        data-testid="notes-input"
      />
      <div className="notes-bar">
        <span className="muted small" data-testid="notes-status">
          {status === 'loading' && 'Loading your note…'}
          {status === 'saving' && 'Saving…'}
          {status === 'saved' && (savedText ? 'Saved ✓' : 'Note deleted')}
          {status === 'error' && <span className="error-text small">{error}</span>}
          {status === 'idle' && updatedAt && `Last saved ${savedAt.format(updatedAt)}`}
          {status === 'idle' && !updatedAt && 'Only you can see your notes.'}
        </span>
        <span className="notes-actions">
          <span className="muted small">{text.length}/{MAX_LENGTH}</span>
          <button
            type="button"
            className="btn-primary"
            onClick={onSave}
            disabled={!dirty || status === 'saving' || status === 'loading'}
            data-testid="notes-save"
          >
            Save note
          </button>
        </span>
      </div>
    </section>
  );
}
