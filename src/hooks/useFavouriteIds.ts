import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { getFavouriteIds, peekFavouriteIds } from '../api/userData';

/**
 * The IDs of the logged-in user's favourite games, or null when logged out / not loaded yet.
 * Uses the list the site already keeps in memory, so it's usually available immediately.
 */
export function useFavouriteIds(): Set<number> | null {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<number> | null>(() => (user ? peekFavouriteIds(user.id) : null));

  useEffect(() => {
    if (!user) {
      setIds(null);
      return;
    }
    let active = true;
    getFavouriteIds(user.id)
      .then((loaded) => active && setIds(loaded))
      .catch(() => {}); // no stars is fine if this fails; the results still show
    return () => {
      active = false;
    };
  }, [user]);

  return ids;
}
