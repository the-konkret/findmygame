import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { isSupabaseConfigured } from '../lib/supabase';

type Mode = 'login' | 'signup';

export default function LoginPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Where to go back to after logging in (e.g. the game page the person came from).
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  if (!loading && user) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
        navigate(from, { replace: true });
      } else {
        const { needsConfirmation } = await signUp(email.trim(), password);
        if (needsConfirmation) {
          setInfo('Account created. Check your inbox and click the confirmation link, then log in.');
          setMode('login');
        } else {
          navigate(from, { replace: true });
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="panel auth-card" data-testid="auth-card">
        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={mode === 'login' ? 'active' : ''}
            onClick={() => { setMode('login'); setError(''); }}
            data-testid="tab-login"
          >
            Log in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => { setMode('signup'); setError(''); setInfo(''); }}
            data-testid="tab-signup"
          >
            Sign up
          </button>
        </div>

        {!isSupabaseConfigured && (
          <p className="error-text" data-testid="auth-not-configured">
            Accounts aren't set up yet: add the Supabase address and key in src/lib/supabase.ts.
          </p>
        )}

        <form onSubmit={onSubmit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="auth-email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="auth-password"
            />
            {mode === 'signup' && <span className="muted small">At least 8 characters.</span>}
          </label>

          {error && <p className="error-text" data-testid="auth-error">{error}</p>}
          {info && <p className="info-text" data-testid="auth-info">{info}</p>}

          <button type="submit" className="btn-primary" disabled={busy || !isSupabaseConfigured} data-testid="auth-submit">
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
      </div>
    </section>
  );
}
