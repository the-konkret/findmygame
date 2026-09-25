import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { getNote, saveNote, type GameRef } from '../api/userData';

const MAX_LENGTH = 5000;
const savedAt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

type Status = 'loading' | 'idle' | 'saving' | 'saved' | 'error';

interface Props {
  game: GameRef;
  /** The "Add a note" button was clicked (the section shows even without a saved note). */
  open: boolean;
  /** Changes each time the button is clicked: scroll here and put the cursor in the box. */
  focusRequest: number;
  /** Tells the page whether there's a saved note (the button then reads "Your note"). */
  onHasNote(has: boolean): void;
  /** Cancel on a new, empty note: hide the section again. */
  onClose(): void;
}

/**
 * Your private note about a game. Hidden until you click "Add a note" at the top of the page,
 * or shown straight away when you've already written one. Not shown at all when logged out.
 */
export default function NotesPanel({ game, open, focusRequest, onHasNote, onClose }: Props) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [savedText, setSavedText] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
        onHasNote(!!note?.body);
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

  // "Add a note" / "Your note" clicked: bring the section into view and put the cursor in the box.
  useEffect(() => {
    if (focusRequest === 0) return;
    const id = requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      inputRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [focusRequest]);

  if (!user) return null;
  const hasSaved = savedText.trim().length > 0;
  if (!open && !hasSaved) return null; // nothing written yet: only the button at the top

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
      onHasNote(clean.length > 0);
      if (!clean) onClose(); // note deleted: hide the section again
    } catch (e) {
      setError((e as Error).message);
      setStatus('error');
    }
  }

  function onCancel() {
    setText(savedText);
    onClose();
  }

  return (
    <section className="panel notes" data-testid="notes-panel" ref={panelRef}>
      <h2>My notes</h2>
      <textarea
        ref={inputRef}
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
          {!hasSaved && (
            <button type="button" className="btn-ghost" onClick={onCancel} data-testid="notes-cancel">
              Cancel
            </button>
          )}
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
