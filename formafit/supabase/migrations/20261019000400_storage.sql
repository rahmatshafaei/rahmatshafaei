-- Private storage buckets. Objects must live under a folder named after the owner's
-- user id ("<uid>/<file>"); policies enforce that on every operation.
-- Size and MIME restrictions are enforced by the bucket and validated again server-side.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('user-media', 'user-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('progress-photos', 'progress-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "media_select_own" on storage.objects
  for select to authenticated
  using (bucket_id in ('user-media', 'progress-photos') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "media_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('user-media', 'progress-photos') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "media_update_own" on storage.objects
  for update to authenticated
  using (bucket_id in ('user-media', 'progress-photos') and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('user-media', 'progress-photos') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "media_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id in ('user-media', 'progress-photos') and (storage.foldername(name))[1] = (select auth.uid())::text);
