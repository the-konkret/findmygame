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

export async function listFavourites(): Promise<FavouriteGame[]> {
  const { data, error } = await supabase
    .from('favourites')
    .select('game_id, game_name, game_image, released, created_at')
    .order('created_at', { ascending: false });
  check(error);
  return data ?? [];
}

// ---- Favourite IDs, kept in memory ----
// The IDs of the user's favourites are loaded once (one small request) and remembered, so every game page
// after the first knows straight away whether the game is a favourite, with no waiting and no flicker.
let favCache: { userId: string; ids: Promise<Set<number>>; known: Set<number> | null } | null = null;

function favouriteIds(userId: string): Promise<Set<number>> {
  if (favCache?.userId !== userId) {
    const entry: NonNullable<typeof favCache> = { userId, ids: Promise.resolve(new Set()), known: null };
    entry.ids = (async () => {
      const { data, error } = await supabase.from('favourites').select('game_id');
      check(error);
      const ids = new Set((data ?? []).map((row) => row.game_id as number));
      entry.known = ids;
      return ids;
    })();
    entry.ids.catch(() => {
      if (favCache === entry) favCache = null; // try again next time
    });
    favCache = entry;
  }
  return favCache.ids;
}

/** Start loading the favourite IDs early (e.g. while the game details are still loading). */
export function prefetchFavourites(userId: string): void {
  favouriteIds(userId).catch(() => {});
}

/** The answer if it's already known, without waiting; undefined if not loaded yet. */
export function peekFavourite(userId: string, gameId: number): boolean | undefined {
  if (favCache?.userId !== userId || !favCache.known) return undefined;
  return favCache.known.has(gameId);
}

export async function isFavourite(userId: string, gameId: number): Promise<boolean> {
  return (await favouriteIds(userId)).has(gameId);
}

export async function addFavourite(userId: string, game: GameRef): Promise<void> {
  const { error } = await supabase.from('favourites').upsert(
    {
      game_id: game.id,
      game_name: game.name,
      game_image: game.background_image ?? null,
      released: game.released ?? null,
    },
    { onConflict: 'user_id,game_id', ignoreDuplicates: true },
  );
  check(error);
  if (favCache?.userId === userId) favCache.known?.add(game.id);
}

export async function removeFavourite(userId: string, gameId: number): Promise<void> {
  const { error } = await supabase.from('favourites').delete().eq('game_id', gameId);
  check(error);
  if (favCache?.userId === userId) favCache.known?.delete(gameId);
}

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
