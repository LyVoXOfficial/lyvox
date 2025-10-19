-- Create reports table and helper trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.reports (
  id bigserial primary key,
  advert_id uuid not null references public.adverts(id) on delete cascade,
  reporter uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'pending',
  reviewed_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists reports_advert_idx on public.reports(advert_id);
create index if not exists reports_status_idx on public.reports(status);
create index if not exists reports_reporter_idx on public.reports(reporter);

drop trigger if exists set_updated_at_reports on public.reports;
create trigger set_updated_at_reports
before update on public.reports
for each row
execute procedure public.set_updated_at();
