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
-- IMPORTANT: the code serves ad-media via short-lived SIGNED URLs (treated as
-- private), but the live bucket is currently public=true (pre-existing config —
-- tracked as a follow-up to lock it down). This migration deliberately does NOT
-- touch `public`: it must neither newly-expose a private bucket nor silently
-- "confirm" the current public state as intended. Only file_size_limit +
-- allowed_mime_types are set here.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ad-media',
  'ad-media',
  false,
  5242880, -- 5 MB, matches signMediaSchema fileSize cap and sanitizeImage maxBytes
  -- Mirror the sanitizer's accept surface so a legit upload is never pre-blocked
  -- at the storage PUT for a format /api/media/complete would transcode to WebP
  -- (notably HEIC/HEIF from desktop). This list is a weak client-declared filter;
  -- file_size_limit above is the real gate.
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/heic', 'image/heif']::text[]
)
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
  -- NOTE: `public` intentionally omitted — never auto-flip the private bucket.
