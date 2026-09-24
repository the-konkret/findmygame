import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { checkAlerts, deleteAlert, markAllRead, onAlertsChanged, type PriceAlert } from '../api/priceAlerts';
import type { BestPrice } from '../api/cheapshark';

/** How often an open FindMyGame tab checks prices. */
const CHECK_EVERY_MS = 30 * 60 * 1000;
/** Coming back to the tab re-checks if the last check is older than this. */
const RECHECK_ON_RETURN_MS = 10 * 60 * 1000;

export interface Notification {
  alert: PriceAlert;
  /** Today's best price, if CheapShark answered. */
  now: BestPrice | null;
  unread: boolean;
}

/** The notifications for the bell: price alerts that have reached their price, newest first. */
export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const lastCheck = useRef(0);
  const running = useRef(false);

  const refresh = useCallback(async () => {
    if (!user || running.current) return;
    running.current = true;
    lastCheck.current = Date.now();
    try {
      const { alerts, prices, priceError } = await checkAlerts();
      setNotifications(
        alerts
          .filter((a) => a.notified_at)
          .sort((a, b) => b.notified_at!.localeCompare(a.notified_at!))
          .map((alert) => ({ alert, now: prices.get(alert.cheapshark_id) ?? null, unread: !alert.read_at })),
      );
      setError(priceError ? "Couldn't check today's prices right now." : '');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      running.current = false;
      setLoaded(true);
    }
  }, [user]);

  useEffect(() => {
    setNotifications([]);
    setLoaded(false);
    if (!user) return;
    refresh();
    const timer = window.setInterval(refresh, CHECK_EVERY_MS);
    const onReturn = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheck.current > RECHECK_ON_RETURN_MS) refresh();
    };
    document.addEventListener('visibilitychange', onReturn);
    // An alert set, changed or removed somewhere else in the app: reload (prices come from the 10-minute memory).
    const stopListening = onAlertsChanged(() => {
      if (!running.current) refresh();
    });
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onReturn);
      stopListening();
    };
  }, [user, refresh]);

  /** Opening the bell: everything shown counts as read. The dots stay visible until the bell closes. */
  const markRead = useCallback(async () => {
    if (!notifications.some((n) => n.unread)) return;
    try {
      await markAllRead();
    } catch {
      // not important enough to show an error; they'll just still count as unread
    }
  }, [notifications]);

  const clearDots = useCallback(() => {
    setNotifications((list) => list.map((n) => ({ ...n, unread: false })));
  }, []);

  const dismiss = useCallback(async (gameId: number) => {
    setNotifications((list) => list.filter((n) => n.alert.game_id !== gameId));
    try {
      await deleteAlert(gameId);
    } catch (e) {
      setError((e as Error).message);
      refresh();
    }
  }, [refresh]);

  return {
    notifications,
    unreadCount: notifications.filter((n) => n.unread).length,
    loaded,
    error,
    markRead,
    clearDots,
    dismiss,
  };
}
