-- Add consent metadata storage to profiles
alter table public.profiles
  add column if not exists consents jsonb;
comment on column public.profiles.consents is 'Latest consent audit snapshot (terms/privacy/marketing).';
