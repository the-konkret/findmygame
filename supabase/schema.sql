-- FindMyGame database setup.
-- Run once in Supabase: SQL Editor → New query → paste this whole file → Run.
-- Safe to run again: it only creates things that don't exist yet.

-- Favourite games, one row per user per game.
-- The game's name and image are copied in, so the favourites page can load without calling RAWG.
create table if not exists public.favourites (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  game_id    integer     not null,
  game_name  text        not null,
  game_image text,
  released   text,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

-- One note per user per game.
create table if not exists public.notes (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  game_id    integer     not null,
  game_name  text        not null,
  body       text        not null check (char_length(body) between 1 and 5000),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

-- Row Level Security: the database itself enforces that people only see and change their own rows.
-- This is what makes it safe for the website to talk to the database directly.
alter table public.favourites enable row level security;
alter table public.notes      enable row level security;

drop policy if exists "Own favourites" on public.favourites;
create policy "Own favourites" on public.favourites
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Own notes" on public.notes;
create policy "Own notes" on public.notes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Logged-in users may use these tables (the policies above still limit them to their own rows).
-- Logged-out visitors get no access at all.
grant select, insert, update, delete on public.favourites, public.notes to authenticated;
revoke all on public.favourites, public.notes from anon;
