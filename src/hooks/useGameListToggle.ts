import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useAuth } from '../auth/AuthProvider';
import { gameLists, type GameListName, type GameRef } from '../api/userData';

export interface GameListToggle {
  user: User | null;
  /** still finding out who's logged in, or whether the game is in the list */
  pending: boolean;
  inList: boolean;
  saving: boolean;
  error: string;
  toggle(): Promise<void>;
}

/**
 * Whether a game is in one of your lists (favourites / wishlist), and a toggle to add or remove it.
 * Uses the remembered list so it's right from the first frame, and flips at once when clicked
 * (saving in the background; if saving fails it flips back and reports the error).
 */
export function useGameListToggle(listName: GameListName, game: GameRef): GameListToggle {
  const list = gameLists[listName];
  const { user, loading } = useAuth();
  const [inList, setInList] = useState<boolean | null>(() => (user ? list.peek(user.id, game.id) ?? null : null));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const known = list.peek(user.id, game.id);
    if (known !== undefined) {
      setInList(known);
      return;
    }
    let active = true;
    setInList(null);
    list
      .has(user.id, game.id)
      .then((v) => active && setInList(v))
      .catch((e: Error) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [user, game.id, list]);

  async function toggle() {
    if (!user || saving || inList === null) return;
    const next = !inList;
    setInList(next);
    setSaving(true);
    setError('');
    try {
      if (next) await list.add(user.id, game);
      else await list.remove(user.id, game.id);
    } catch (e) {
      setInList(!next);
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return {
    user,
    pending: loading || (!!user && inList === null && !error),
    inList: !!inList,
    saving,
    error,
    toggle,
  };
}
