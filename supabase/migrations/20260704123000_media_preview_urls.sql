alter table public.media
  add column if not exists preview_url text,
  add column if not exists preview_w integer,
  add column if not exists preview_h integer,
  add column if not exists preview_mime text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ad-media-preview',
  'ad-media-preview',
  true,
  1048576,
  array['image/webp', 'image/jpeg', 'image/png']::text[]
)
on conflict (id) do update
set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ad media preview public read" on storage.objects;
create policy "ad media preview public read"
on storage.objects
for select
to public
using (bucket_id = 'ad-media-preview');
