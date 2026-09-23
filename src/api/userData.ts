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

export async function isFavourite(gameId: number): Promise<boolean> {
  const { count, error } = await supabase
    .from('favourites')
    .select('game_id', { count: 'exact', head: true })
    .eq('game_id', gameId);
  check(error);
  return (count ?? 0) > 0;
}

export async function addFavourite(game: GameRef): Promise<void> {
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
}

export async function removeFavourite(gameId: number): Promise<void> {
  const { error } = await supabase.from('favourites').delete().eq('game_id', gameId);
  check(error);
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
