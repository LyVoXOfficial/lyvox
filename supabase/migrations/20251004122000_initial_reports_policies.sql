-- Initial RLS policies and helper function for reports workflow
alter table if exists public.reports enable row level security;

drop policy if exists "Allow user to select own sent reports or reports on their adverts" on public.reports;
create policy "Allow user to select own sent reports or reports on their adverts" on public.reports
  for select to authenticated using (
    reporter = auth.uid()
    or exists (
      select 1 from public.adverts a where a.id = public.reports.advert_id and a.user_id = auth.uid()
    )
  );

drop policy if exists "Allow authenticated user to insert own report" on public.reports;
create policy "Allow authenticated user to insert own report" on public.reports
  for insert to authenticated with check (reporter = auth.uid());

alter table if exists public.trust_score enable row level security;

drop policy if exists "Allow user to read own trust score" on public.trust_score;
create policy "Allow user to read own trust score" on public.trust_score
  for select to authenticated using (user_id = auth.uid());

create or replace function public.trust_inc(uid uuid, pts int)
returns void
language plpgsql
as $$
begin
  insert into public.trust_score(user_id, score)
  values (uid, pts)
  on conflict (user_id)
  do update set
    score = public.trust_score.score + excluded.score,
    updated_at = now();
end;
$$;
