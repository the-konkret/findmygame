-- FindMyGame: price alerts and the notification bell.
-- "Tell me when this game costs $X or less." When the app sees the price drop that low, the alert becomes
-- a notification under the bell in the top bar.
-- Run once in Supabase: SQL Editor → New query → paste this whole file → Run. Safe to run again.

create table if not exists public.price_alerts (
  user_id        uuid          not null default auth.uid() references auth.users (id) on delete cascade,
  game_id        integer       not null,               -- RAWG id (link back to the game page)
  game_name      text          not null,
  game_image     text,
  cheapshark_id  text          not null,               -- the game on CheapShark, where prices come from
  target_price   numeric(8, 2) not null check (target_price > 0 and target_price < 1000),
  created_at     timestamptz   not null default now(),
  -- Filled in when the price first reaches the target: the alert is now a notification.
  notified_at    timestamptz,
  notified_price numeric(8, 2),
  notified_store text,
  -- When you opened the bell after that (empty = unread, counted on the bell).
  read_at        timestamptz,
  primary key (user_id, game_id)
);

-- Each person sees and changes only their own alerts.
alter table public.price_alerts enable row level security;

drop policy if exists "Own price alerts" on public.price_alerts;
create policy "Own price alerts" on public.price_alerts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.price_alerts to authenticated;
revoke all on public.price_alerts from anon;

notify pgrst, 'reload schema';
