import { useRef, useState, type ChangeEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useLogOut } from '../auth/useLogOut';
import { useAuth } from '../auth/AuthProvider';
import { removeAvatar, uploadAvatar } from '../api/avatar';
import ChangePassword from '../components/ChangePassword';
import ThemePicker from '../components/ThemePicker';

export default function AccountPage() {
  const { user, loading } = useAuth();
  const logOut = useLogOut();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'' | 'uploading' | 'removing'>('');
  const [error, setError] = useState('');

  if (loading) return <p className="status">Loading…</p>;
  if (!user) return <Navigate to="/login" state={{ from: '/account' }} replace />;

  const email = user.email ?? '';
  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null;

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // so picking the same file again still counts as a change
    if (!file || !user) return;
    setBusy('uploading');
    setError('');
    try {
      await uploadAvatar(user.id, file);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy('');
    }
  }

  async function onRemove() {
    if (!user) return;
    setBusy('removing');
    setError('');
    try {
      await removeAvatar(user.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="account-page">
      <h1 className="page-title">Account</h1>

      <div className="panel account-section" data-testid="avatar-section">
        <h2>Profile picture</h2>
        <div className="avatar-row">
          <div className="avatar avatar-large" aria-busy={busy !== ''}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Your profile picture" data-testid="avatar-image" />
            ) : (
              <span className="avatar-initial" data-testid="avatar-initial">{(email[0] ?? '?').toUpperCase()}</span>
            )}
          </div>
          <div className="avatar-actions">
            <div className="avatar-buttons">
              <button
                type="button"
                className="btn-primary"
                onClick={() => fileRef.current?.click()}
                disabled={busy !== ''}
                data-testid="avatar-upload"
              >
                {busy === 'uploading' ? 'Uploading…' : avatarUrl ? 'Change picture' : 'Upload picture'}
              </button>
              {avatarUrl && (
                <button type="button" className="btn-ghost" onClick={onRemove} disabled={busy !== ''} data-testid="avatar-remove">
                  {busy === 'removing' ? 'Removing…' : 'Remove'}
                </button>
              )}
            </div>
            <p className="muted small">JPG, PNG or WebP, up to 1 MB. It's cropped to a square and shrunk to a small size.</p>
            {error && <p className="error-text" data-testid="avatar-error">{error}</p>}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onPick}
            hidden
            data-testid="avatar-input"
          />
        </div>
      </div>

      <ThemePicker />

      <ChangePassword email={email} />

      <div className="panel account-section">
        <h2>Account details</h2>
        <dl className="account-details">
          <dt>Email</dt>
          <dd data-testid="account-email">{email}</dd>
        </dl>
        <button
          type="button"
          className="btn-ghost account-logout"
          onClick={logOut}
          data-testid="account-logout"
        >
          Log out
        </button>
      </div>
    </section>
  );
}
