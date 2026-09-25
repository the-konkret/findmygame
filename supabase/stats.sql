-- FindMyGame: visit statistics for the /stats page.
-- Each page view is recorded (which page, when, logged in or not, and an anonymous random ID kept in the
-- visitor's browser so repeat visits count as one visitor). No IP addresses, no names, no emails.
-- Nobody can read the individual rows: the /stats page only gets totals, through the site_stats() function.
-- Run once in Supabase: SQL Editor → New query → paste this whole file → Run. Safe to run again.

create table if not exists public.page_views (
  id         bigint generated always as identity primary key,
  visitor_id uuid        not null,                                   -- anonymous, random, per browser
  user_id    uuid        references auth.users (id) on delete set null, -- empty when logged out
  path       text        not null check (char_length(path) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists page_views_created_at on public.page_views (created_at);

alter table public.page_views enable row level security;

-- Anyone may ADD a page view (logged in or not), only as themselves. Nobody may read, change or delete rows.
drop policy if exists "Record page views" on public.page_views;
create policy "Record page views" on public.page_views
  for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

revoke all on public.page_views from anon, authenticated;
grant insert (visitor_id, user_id, path) on public.page_views to anon, authenticated;

-- Totals for the /stats page. Runs with the owner's rights (so it can count), but only ever returns counts.
-- Days are counted in Polish time.
create or replace function public.site_stats(days integer default 30)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select greatest(1, least(coalesce(days, 30), 90)) as days,
           (now() at time zone 'Europe/Warsaw')::date as today
  ),
  v as (
    select visitor_id, user_id, path, (created_at at time zone 'Europe/Warsaw')::date as day
    from public.page_views
  ),
  ranges as (
    select label, since from params, lateral (values
      ('today', today), ('week', today - 6), ('month', today - 29), ('all', date '2000-01-01')
    ) as r(label, since)
  ),
  totals as (
    select r.label,
           count(v.*)                                              as views,
           count(distinct v.visitor_id)                            as visitors,
           count(distinct v.user_id)                               as logged_in_users,
           count(distinct v.visitor_id) filter (where v.user_id is null) as logged_out_visitors
    from ranges r left join v on v.day >= r.since
    group by r.label
  ),
  daily as (
    select d::date as day,
           count(distinct v.user_id)                                     as logged_in,
           count(distinct v.visitor_id) filter (where v.user_id is null) as logged_out,
           count(v.*)                                                    as views
    from params, generate_series(today - (days - 1), today, interval '1 day') as d
    left join v on v.day = d::date
    group by d
    order by d
  ),
  pages as (
    select path, count(*) as views, count(distinct visitor_id) as visitors
    from v, params where v.day >= params.today - (params.days - 1)
    group by path order by views desc, path limit 10
  )
  select json_build_object(
    'accounts', (select count(*) from auth.users),
    'totals',   (select json_object_agg(label, json_build_object(
                   'views', views, 'visitors', visitors,
                   'logged_in_users', logged_in_users, 'logged_out_visitors', logged_out_visitors)) from totals),
    'daily',    (select json_agg(json_build_object('day', day, 'logged_in', logged_in, 'logged_out', logged_out, 'views', views)) from daily),
    'pages',    (select coalesce(json_agg(json_build_object('path', path, 'views', views, 'visitors', visitors)), '[]'::json) from pages)
  );
$$;

revoke all on function public.site_stats(integer) from public;
grant execute on function public.site_stats(integer) to anon, authenticated;

notify pgrst, 'reload schema';
