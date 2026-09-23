-- FindMyGame: wishlist.
-- Run once in Supabase: SQL Editor → New query → paste this whole file → Run.
-- Safe to run again. Works exactly like the favourites table (see schema.sql).

create table if not exists public.wishlist (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  game_id    integer     not null,
  game_name  text        not null,
  game_image text,
  released   text,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

-- Each person sees and changes only their own wishlist.
alter table public.wishlist enable row level security;

drop policy if exists "Own wishlist" on public.wishlist;
create policy "Own wishlist" on public.wishlist
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.wishlist to authenticated;
revoke all on public.wishlist from anon;
