-- === Add helper to read admin role from JWT ===
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(
    ((current_setting('request.jwt.claims', true))::jsonb -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- === Example: replace all 'coalesce(request.jwt()->>'role','') = 'admin'' with 'is_admin()' ===
-- adverts
alter table if exists public.adverts enable row level security;
drop policy if exists "Public can read active adverts" on public.adverts;
create policy "Public can read active adverts" on public.adverts
  for select using (status = 'active');

drop policy if exists "Owner can read own adverts" on public.adverts;
create policy "Owner can read own adverts" on public.adverts
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Owner manage own adverts" on public.adverts;
create policy "Owner manage own adverts" on public.adverts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Admin can manage adverts" on public.adverts;
create policy "Admin can manage adverts" on public.adverts
  for all using (is_admin()) with check (is_admin());

-- media
alter table if exists public.media enable row level security;
drop policy if exists "Public view active advert media" on public.media;
create policy "Public view active advert media" on public.media
  for select using (
    exists (select 1 from public.adverts a
            where a.id = media.advert_id and a.status = 'active')
  );

drop policy if exists "Owner view media" on public.media;
create policy "Owner view media" on public.media
  for select to authenticated using (
    exists (select 1 from public.adverts a
            where a.id = media.advert_id and a.user_id = auth.uid())
  );

drop policy if exists "Owner manage media" on public.media;
create policy "Owner manage media" on public.media
  for all to authenticated using (
    exists (select 1 from public.adverts a
            where a.id = media.advert_id and a.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.adverts a
            where a.id = media.advert_id and a.user_id = auth.uid())
  );

drop policy if exists "Admin manage media" on public.media;
create policy "Admin manage media" on public.media
  for all using (is_admin()) with check (is_admin());

-- profiles
alter table if exists public.profiles enable row level security;
drop policy if exists "Owner read profile" on public.profiles;
create policy "Owner read profile" on public.profiles
  for select to authenticated using (id = auth.uid());
drop policy if exists "Owner upsert profile" on public.profiles;
create policy "Owner upsert profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());
drop policy if exists "Owner update profile" on public.profiles;
create policy "Owner update profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "Owner delete profile" on public.profiles;
create policy "Owner delete profile" on public.profiles
  for delete to authenticated using (id = auth.uid());
drop policy if exists "Admin manage profiles" on public.profiles;
create policy "Admin manage profiles" on public.profiles
  for all using (is_admin()) with check (is_admin());

-- phones
alter table if exists public.phones enable row level security;
drop policy if exists "Owner read phone" on public.phones;
create policy "Owner read phone" on public.phones
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Owner upsert phone" on public.phones;
create policy "Owner upsert phone" on public.phones
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Admin manage phones" on public.phones;
create policy "Admin manage phones" on public.phones
  for all using (is_admin()) with check (is_admin());

-- phone_otps
alter table if exists public.phone_otps enable row level security;
drop policy if exists "Owner read active OTP" on public.phone_otps;
create policy "Owner read active OTP" on public.phone_otps
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Owner manage OTP" on public.phone_otps;
create policy "Owner manage OTP" on public.phone_otps
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Admin manage OTP" on public.phone_otps;
create policy "Admin manage OTP" on public.phone_otps
  for all using (is_admin()) with check (is_admin());

-- reports
alter table if exists public.reports enable row level security;
drop policy if exists "Allow user to select own sent reports or reports on their adverts" on public.reports;
create policy "Allow user to select own sent reports or reports on their adverts" on public.reports
  for select to authenticated using (
    reporter = auth.uid()
    or exists (select 1 from public.adverts a where a.id = reports.advert_id and a.user_id = auth.uid())
  );

drop policy if exists "Allow authenticated user to insert own report" on public.reports;
create policy "Allow authenticated user to insert own report" on public.reports
  for insert to authenticated with check (reporter = auth.uid());

drop policy if exists "Admin manage reports" on public.reports;
create policy "Admin manage reports" on public.reports
  for all using (is_admin()) with check (is_admin());

-- trust_score
alter table if exists public.trust_score enable row level security;
drop policy if exists "Allow user to read own trust score" on public.trust_score;
create policy "Allow user to read own trust score" on public.trust_score
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Admin manage trust score" on public.trust_score;
create policy "Admin manage trust score" on public.trust_score
  for all using (is_admin()) with check (is_admin());

-- logs
alter table if exists public.logs enable row level security;
drop policy if exists "Owner insert log" on public.logs;
create policy "Owner insert log" on public.logs
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Service/admin read logs" on public.logs;
create policy "Service/admin read logs" on public.logs
  for select using (auth.role() = 'service_role' or is_admin());

-- (опционально) public read categories/locations
alter table if exists public.categories enable row level security;
drop policy if exists "Public read categories" on public.categories;
create policy "Public read categories" on public.categories for select using (true);

alter table if exists public.locations enable row level security;
drop policy if exists "Public read locations" on public.locations;
create policy "Public read locations" on public.locations for select using (true);
