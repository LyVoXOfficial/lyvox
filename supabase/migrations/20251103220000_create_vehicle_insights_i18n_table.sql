-- Create vehicle_insights_i18n table for storing translated insights
create table if not exists public.vehicle_insights_i18n (
  model_id uuid not null,
  locale text not null check (locale = ANY (ARRAY['en'::text, 'fr'::text, 'nl'::text, 'ru'::text, 'de'::text])),
  pros text[] default '{}'::text[],
  cons text[] default '{}'::text[],
  inspection_tips text[] default '{}'::text[],
  notable_features text[] default '{}'::text[],
  engine_examples text[] default '{}'::text[],
  common_issues text[] default '{}'::text[],
  created_at timestamp with time zone not null default now(),

  constraint vehicle_insights_i18n_pkey primary key (model_id, locale),
  constraint vehicle_insights_i18n_model_id_fkey foreign key (model_id) references public.vehicle_insights(model_id) on delete cascade
);

-- Create index for faster lookups by locale
create index if not exists vehicle_insights_i18n_locale_idx on public.vehicle_insights_i18n(locale);

-- Enable RLS
alter table public.vehicle_insights_i18n enable row level security;

-- Create policy for public read access
create policy "Enable read access for all users" on public.vehicle_insights_i18n
  for select using (true);

