-- DB-006: Favorites table, indexes, and RLS policies
-- Ensures favorites infrastructure exists even if prior mixed migrations ran

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  advert_id uuid not null references public.adverts(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, advert_id)
);

create index if not exists favorites_user_id_idx on public.favorites(user_id, created_at desc);
create index if not exists favorites_advert_id_idx on public.favorites(advert_id);

alter table public.favorites enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'favorites'
      and policyname = 'user_manage_own_favorites'
  ) then
    execute $policy$
      create policy "user_manage_own_favorites" on public.favorites
        for all
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id);
    $policy$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'favorites'
      and policyname = 'public_read_favorites'
  ) then
    execute $policy$
      create policy "public_read_favorites" on public.favorites
        for select
        using (true);
    $policy$;
  end if;
end $$;

comment on table public.favorites is 'User bookmarks/favorites for adverts';

