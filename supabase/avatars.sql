-- FindMyGame: profile pictures (avatars).
-- Run once in Supabase: SQL Editor → New query → paste this whole file → Run.
-- Safe to run again.

-- A storage "bucket" (folder) for avatars.
--   public = true      → pictures can be shown on the page with a plain link
--   file_size_limit    → the server refuses anything over 200 KB (the site shrinks pictures to ~20–40 KB first)
--   allowed_mime_types → only real picture formats
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 204800, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Each person may only add, change or delete files inside their own folder: avatars/<their user id>/...
drop policy if exists "Avatar: read own" on storage.objects;
create policy "Avatar: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Avatar: upload own" on storage.objects;
create policy "Avatar: upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Avatar: replace own" on storage.objects;
create policy "Avatar: replace own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Avatar: delete own" on storage.objects;
create policy "Avatar: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
