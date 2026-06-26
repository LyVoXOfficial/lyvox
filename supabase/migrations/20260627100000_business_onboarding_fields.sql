-- Business-onboarding slice: self-certification + trader terms (consumer-law / DSA panel).
alter table public.businesses add column if not exists self_certified_at  timestamptz;
alter table public.businesses add column if not exists self_certified_ip  text;
alter table public.businesses add column if not exists withdrawal_terms   text;
alter table public.businesses add column if not exists returns_url        text;
