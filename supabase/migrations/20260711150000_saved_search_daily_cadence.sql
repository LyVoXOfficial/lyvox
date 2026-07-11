-- Saved-search alerts are dispatched by the once-daily production cron.
-- Normalize the former unsupported "instant" setting so the stored contract
-- matches the cadence the platform can actually deliver.

update public.saved_searches
set alert_frequency = 'daily'
where alert_frequency = 'instant';

alter table public.saved_searches
  drop constraint if exists saved_searches_alert_frequency_check;

alter table public.saved_searches
  add constraint saved_searches_alert_frequency_check
  check (alert_frequency in ('daily', 'off'));
