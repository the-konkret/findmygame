// Favourites and notes, stored in Supabase. Row Level Security in the database makes sure
// every query only ever touches the logged-in user's own rows.
import { supabase } from '../lib/supabase';

export interface FavouriteGame {
  game_id: number;
  game_name: string;
  game_image: string | null;
  released: string | null;
  created_at: string;
}

export interface GameRef {
  id: number;
  name: string;
  background_image?: string | null;
  released?: string | null;
}

function check(error: { message: string } | null): void {
  if (error) throw new Error(`Couldn't reach your saved data: ${error.message}`);
}

// ---- Saved-game lists: favourites and wishlist ----
// Both work the same way: one row per user per game, in their own table.
// The IDs in each list are loaded once (one small request) and remembered, so game pages know straight
// away whether a game is in the list, with no waiting and no flicker.

export type GameListName = 'favourites' | 'wishlist';

function makeGameList(table: GameListName) {
  let cache: { userId: string; ids: Promise<Set<number>>; known: Set<number> | null } | null = null;

  function ids(userId: string): Promise<Set<number>> {
    if (cache?.userId !== userId) {
      const entry: NonNullable<typeof cache> = { userId, ids: Promise.resolve(new Set()), known: null };
      entry.ids = (async () => {
        const { data, error } = await supabase.from(table).select('game_id');
        check(error);
        const set = new Set((data ?? []).map((row) => row.game_id as number));
        entry.known = set;
        return set;
      })();
      entry.ids.catch(() => {
        if (cache === entry) cache = null; // try again next time
      });
      cache = entry;
    }
    return cache.ids;
  }

  return {
    /** The games in the list, newest first. */
    async list(): Promise<FavouriteGame[]> {
      const { data, error } = await supabase
        .from(table)
        .select('game_id, game_name, game_image, released, created_at')
        .order('created_at', { ascending: false });
      check(error);
      return data ?? [];
    },
    /** All the game IDs in the list (a copy, safe to keep). */
    async getIds(userId: string): Promise<Set<number>> {
      return new Set(await ids(userId));
    },
    /** The IDs if already loaded, without waiting; null if not loaded yet. */
    peekIds(userId: string): Set<number> | null {
      return cache?.userId === userId && cache.known ? new Set(cache.known) : null;
    },
    prefetch(userId: string): void {
      ids(userId).catch(() => {});
    },
    /** The answer if already known, without waiting; undefined if not loaded yet. */
    peek(userId: string, gameId: number): boolean | undefined {
      if (cache?.userId !== userId || !cache.known) return undefined;
      return cache.known.has(gameId);
    },
    async has(userId: string, gameId: number): Promise<boolean> {
      return (await ids(userId)).has(gameId);
    },
    async add(userId: string, game: GameRef): Promise<void> {
      const { error } = await supabase.from(table).upsert(
        {
          game_id: game.id,
          game_name: game.name,
          game_image: game.background_image ?? null,
          released: game.released ?? null,
        },
        { onConflict: 'user_id,game_id', ignoreDuplicates: true },
      );
      check(error);
      if (cache?.userId === userId) cache.known?.add(game.id);
    },
    async remove(userId: string, gameId: number): Promise<void> {
      const { error } = await supabase.from(table).delete().eq('game_id', gameId);
      check(error);
      if (cache?.userId === userId) cache.known?.delete(gameId);
    },
  };
}

export const favourites = makeGameList('favourites');
export const wishlist = makeGameList('wishlist');
export const gameLists = { favourites, wishlist };

// Older names, still used around the app.
export const listFavourites = () => favourites.list();
export const getFavouriteIds = (userId: string) => favourites.getIds(userId);
export const peekFavouriteIds = (userId: string) => favourites.peekIds(userId);
export const prefetchFavourites = (userId: string) => favourites.prefetch(userId);
export const peekFavourite = (userId: string, gameId: number) => favourites.peek(userId, gameId);
export const isFavourite = (userId: string, gameId: number) => favourites.has(userId, gameId);
export const addFavourite = (userId: string, game: GameRef) => favourites.add(userId, game);
export const removeFavourite = (userId: string, gameId: number) => favourites.remove(userId, gameId);

export async function getNote(gameId: number): Promise<{ body: string; updated_at: string } | null> {
  const { data, error } = await supabase
    .from('notes')
    .select('body, updated_at')
    .eq('game_id', gameId)
    .maybeSingle();
  check(error);
  return data;
}

/** Saves the note; an empty note deletes it. */
export async function saveNote(game: GameRef, body: string): Promise<void> {
  const text = body.trim();
  if (!text) {
    const { error } = await supabase.from('notes').delete().eq('game_id', game.id);
    check(error);
    return;
  }
  const { error } = await supabase.from('notes').upsert(
    { game_id: game.id, game_name: game.name, body: text, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,game_id' },
  );
  check(error);
}
