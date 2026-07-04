-- SEC-UPLOAD: make the PUBLIC ad-media-preview bucket server(service-role)-write-only.
--
-- Context (verified against the live DB): storage.objects carries a permissive
-- template policy "Enable insert for authenticated users only" (WITH CHECK true)
-- that lets ANY authenticated user .upload() directly to ANY bucket — bypassing
-- the signed-upload token. Since the preview is now derived server-side in
-- /api/media/complete from the sanitised full image (the client no longer uploads
-- a preview at all), block authenticated/anon inserts into ad-media-preview so the
-- publicly-served thumbnail can only ever be sanitised bytes written by the server.
--
-- A RESTRICTIVE policy AND's with the permissive policies, so this closes ONLY
-- ad-media-preview without changing insert behaviour for any other bucket. The
-- service role bypasses RLS entirely, so the server-side preview write still
-- succeeds. UPDATE on this bucket is already denied (the sole UPDATE policy is
-- scoped to ad-media), so insert + update are both closed for non-service callers.
--
-- NOTE (tracked follow-up, out of scope here): the broad "Enable insert for
-- authenticated users only" policy still lets authenticated users write arbitrary
-- paths in other buckets, and ad-media is currently public=true though the code
-- serves it via signed URLs. Both need a holistic storage-RLS/bucket-privacy pass.
drop policy if exists "ad-media-preview server write only" on storage.objects;
create policy "ad-media-preview server write only"
on storage.objects
as restrictive
for insert
to authenticated, anon
with check (bucket_id <> 'ad-media-preview');
