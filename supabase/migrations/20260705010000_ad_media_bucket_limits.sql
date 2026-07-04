-- SEC-UPLOAD: bound the private full-res `ad-media` bucket.
--
-- Uploads reach this bucket directly from the browser via a signed upload URL.
-- The /api/media/sign route only validates the CLIENT-CLAIMED fileSize in JSON —
-- the actual bytes pushed to the signed URL are bounded solely by the bucket's
-- file_size_limit. /api/media/complete then DOWNLOADS the object into memory to
-- sanitise it, so without this cap a client could claim 1 MB at sign time and
-- push a multi-hundred-MB object, OOM-ing the sanitiser. file_size_limit is the
-- real gate here; allowed_mime_types is only a weak (client-declared) secondary
-- filter.
--
-- IMPORTANT: `ad-media` is PRIVATE (served via short-lived signed URLs). This
-- migration must never flip it public — the on-conflict branch deliberately does
-- NOT touch `public`.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ad-media',
  'ad-media',
  false,
  5242880, -- 5 MB, matches signMediaSchema fileSize cap and sanitizeImage maxBytes
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']::text[]
)
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
  -- NOTE: `public` intentionally omitted — never auto-flip the private bucket.
