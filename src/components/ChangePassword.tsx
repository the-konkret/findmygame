import { useState, type FormEvent } from 'react';
import { changePassword, checkNewPassword, MIN_PASSWORD } from '../api/password';

/** "Password" section on the Account page. */
export default function ChangePassword({ email }: { email: string }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setDone(false);
    const problem = checkNewPassword(next, repeat);
    if (problem) return setError(problem);
    if (next === current) return setError('The new password is the same as the current one.');
    setBusy(true);
    try {
      await changePassword(email, current, next);
      setDone(true);
      setCurrent('');
      setNext('');
      setRepeat('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel account-section" data-testid="password-section">
      <h2>Password</h2>
      <form className="auth-form password-form" onSubmit={onSubmit}>
        <label>
          Current password
          <input type="password" autoComplete="current-password" required value={current}
            onChange={(e) => setCurrent(e.target.value)} data-testid="password-current" />
        </label>
        <label>
          New password
          <input type="password" autoComplete="new-password" required minLength={MIN_PASSWORD} value={next}
            onChange={(e) => setNext(e.target.value)} data-testid="password-new" />
          <span className="muted small">At least {MIN_PASSWORD} characters.</span>
        </label>
        <label>
          Repeat new password
          <input type="password" autoComplete="new-password" required value={repeat}
            onChange={(e) => setRepeat(e.target.value)} data-testid="password-repeat" />
        </label>
        {error && <p className="error-text" data-testid="password-error">{error}</p>}
        {done && <p className="info-text" data-testid="password-done">Password changed ✓</p>}
        <button type="submit" className="btn-primary" disabled={busy} data-testid="password-submit">
          {busy ? 'Changing…' : 'Change password'}
        </button>
      </form>
    </div>
  );
}
