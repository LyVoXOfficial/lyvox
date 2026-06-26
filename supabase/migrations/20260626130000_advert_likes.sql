-- Likes: a public popularity signal, mirroring the favorites table.
-- Idempotent; applied surgically via pg.

create table if not exists public.advert_likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  advert_id uuid not null references public.adverts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, advert_id)
);

create index if not exists advert_likes_user_id_idx on public.advert_likes(user_id, created_at desc);
create index if not exists advert_likes_advert_id_idx on public.advert_likes(advert_id);

alter table public.advert_likes enable row level security;

drop policy if exists user_manage_own_likes on public.advert_likes;
create policy user_manage_own_likes on public.advert_likes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists public_read_likes on public.advert_likes;
create policy public_read_likes on public.advert_likes
  for select
  using (true);

create or replace function public.get_advert_like_count(advert_id_param uuid)
returns bigint
language sql
stable
as $$
  select count(*) from public.advert_likes where advert_id = advert_id_param;
$$;
