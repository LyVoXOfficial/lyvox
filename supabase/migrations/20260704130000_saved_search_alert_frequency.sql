-- T12: per-saved-search alert cadence. Additive and idempotent.

alter table public.saved_searches
  add column if not exists alert_frequency text not null default 'daily';

alter table public.saved_searches drop constraint if exists saved_searches_alert_frequency_check;
alter table public.saved_searches add constraint saved_searches_alert_frequency_check
  check (alert_frequency in ('instant', 'daily', 'off'));

update public.saved_searches
set alert_frequency = case when alert_enabled then 'daily' else 'off' end
where alert_frequency is null;
