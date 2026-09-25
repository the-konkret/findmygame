import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useNotifications, type Notification } from '../hooks/useNotifications';
import { timeAgo, usd } from '../lib/format';
import { BellIcon, CloseIcon } from './Icons';

/**
 * The bell in the top bar, next to the cog / profile picture. The number on it counts unread notifications.
 * Click / tap opens a dropdown: your price-alert notifications, or a short "nothing yet" message.
 */
export default function NotificationBell() {
  const { notifications, unreadCount, loaded, error, markRead, clearDots, dismiss } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  function close() {
    setOpen(false);
    clearDots(); // the "new" dots go once you've seen them
  }

  // Close when moving to another page.
  useEffect(() => {
    if (open) close();
  }, [pathname]);

  // Close on a tap/click outside, or Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggle() {
    if (open) return close();
    setOpen(true);
    markRead();
  }

  const label = unreadCount > 0 ? `Notifications, ${unreadCount} new` : 'Notifications';

  return (
    <div className="bell-menu" ref={wrapRef}>
      <button
        type="button"
        className={`nav-icon nav-bell ${open ? 'active' : ''}`}
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={toggle}
        data-testid="nav-bell"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="bell-badge" data-testid="bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="bell-dropdown" role="region" aria-label="Notifications" data-testid="bell-dropdown">
          <div className="bell-head">Notifications</div>

          {!loaded && <p className="bell-empty muted">Checking prices…</p>}

          {loaded && notifications.length === 0 && (
            <div className="bell-empty" data-testid="bell-empty">
              <BellIcon size={28} className="bell-empty-icon" />
              <p className="bell-empty-title">No notifications yet</p>
              <p className="muted small">
                Open a game and use "Notify me when the price drops" in the Deals box. When the price falls to
                your number, it shows up here.
              </p>
            </div>
          )}

          {notifications.length > 0 && (
            <ul className="bell-list">
              {notifications.map((n) => (
                <NotificationItem key={n.alert.game_id} n={n} onDismiss={() => dismiss(n.alert.game_id)} />
              ))}
            </ul>
          )}

          {error && <p className="error-text bell-error" data-testid="bell-error">{error}</p>}
        </div>
      )}
    </div>
  );
}

function NotificationItem({ n, onDismiss }: { n: Notification; onDismiss: () => void }) {
  const { alert, now } = n;
  const target = usd.format(alert.target_price);
  const hitExactly = alert.notified_price === alert.target_price;
  const backUp = now && now.price > alert.target_price;

  return (
    <li className={`bell-item ${n.unread ? 'unread' : ''}`} data-testid="notification">
      <Link to={`/game/${alert.game_id}`} className="bell-link">
        {alert.game_image ? <img src={alert.game_image} alt="" className="bell-thumb" loading="lazy" /> : <span className="bell-thumb" />}
        <span className="bell-text">
          <span className="bell-title" data-testid="notification-text">
            <strong>{alert.game_name}</strong>{' '}
            {hitExactly ? <>has reached your price of <strong>{target}</strong></> : <>has fallen below <strong>{target}</strong></>}
          </span>
          <span className={`bell-price ${backUp ? 'back-up' : ''}`} data-testid="notification-price">
            {now ? (
              <>
                Now <strong>{usd.format(now.price)}</strong> at {now.storeName}
                {backUp && alert.notified_price != null && ` · it was ${usd.format(alert.notified_price)}`}
              </>
            ) : alert.notified_price != null ? (
              <>Dropped to <strong>{usd.format(alert.notified_price)}</strong>{alert.notified_store && ` at ${alert.notified_store}`}</>
            ) : null}
          </span>
          <span className="bell-time">{timeAgo(alert.notified_at!)}</span>
        </span>
        {n.unread && <span className="bell-dot" aria-label="new" />}
      </Link>
      <button
        type="button"
        className="bell-dismiss"
        onClick={onDismiss}
        aria-label={`Remove the notification for ${alert.game_name}`}
        title="Remove"
        data-testid="notification-dismiss"
      >
        <CloseIcon size={12} />
      </button>
    </li>
  );
}
