alter table public.profiles add column if not exists pro_until         timestamptz;
alter table public.profiles add column if not exists stripe_customer_id text;
