-- SEC-UPLOAD / Storage-RLS: lock down the `ad-media` bucket to owner-scoped,
-- private access. Drop the permissive template insert policy, replace it with an
-- owner-only insert, flip the bucket private, and drop public read.
--
-- PROVENANCE: these 5 statements were applied directly to the production DB
-- (out-of-band, via psql) on 2026-07-05 01:30 and recorded in
-- supabase_migrations.schema_migrations as version 20260705013000, but the
-- migration FILE was never committed — leaving local behind remote and blocking
-- `supabase db push`. This file reconstructs those exact statements verbatim so
-- local history matches prod. It is idempotent; on a fresh DB it produces the
-- same end state that prod already has. See [[storage-rls-privacy-state]].
drop policy if exists "Enable insert for authenticated users only" on storage.objects;
drop policy if exists "ad-media owner insert" on storage.objects;
create policy "ad-media owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ad-media' and (auth.uid())::text = (storage.foldername(name))[1]);
update storage.buckets set public = false where id = 'ad-media';
drop policy if exists "ad-media public read" on storage.objects;
