-- CS-001: Catalog schema foundation (fields, options, subcategory schema)
-- Provides metadata tables used to render dynamic forms per subcategory.

create table if not exists public.catalog_fields (
  id uuid primary key default gen_random_uuid(),
  field_key text not null unique,
  label_i18n_key text,
  description_i18n_key text,
  field_type text not null,
  domain text,
  is_required boolean not null default false,
  unit text,
  min_value numeric,
  max_value numeric,
  pattern text,
  group_key text,
  sort integer default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.catalog_fields is 'Reusable field definitions for catalog subcategories.';
comment on column public.catalog_fields.field_key is 'Stable machine name, referenced from schemas.';
comment on column public.catalog_fields.field_type is 'Input type (text, number, select, multiselect, toggle, range, date, etc.).';

create index if not exists catalog_fields_domain_idx on public.catalog_fields(domain);
create index if not exists catalog_fields_group_idx on public.catalog_fields(group_key);

create table if not exists public.catalog_field_options (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.catalog_fields(id) on delete cascade,
  code text not null,
  name_i18n_key text not null,
  sort integer default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_field_options_field_code_key unique (field_id, code)
);

comment on table public.catalog_field_options is 'Lookup values for select/multiselect catalog fields.';

create index if not exists catalog_field_options_field_idx on public.catalog_field_options(field_id);

create table if not exists public.catalog_subcategory_schema (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  version integer not null default 1,
  is_active boolean not null default true,
  steps jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_subcategory_schema_steps_array check (jsonb_typeof(steps) = 'array'),
  constraint catalog_subcategory_schema_category_version_key unique (category_id, version)
);

comment on table public.catalog_subcategory_schema is 'Per-subcategory form schema composed of ordered steps referencing catalog fields.';

create index if not exists catalog_subcategory_schema_category_idx on public.catalog_subcategory_schema(category_id);
create index if not exists catalog_subcategory_schema_active_idx on public.catalog_subcategory_schema(is_active);

create or replace function public.touch_catalog_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists catalog_fields_touch on public.catalog_fields;
create trigger catalog_fields_touch
  before update on public.catalog_fields
  for each row execute procedure public.touch_catalog_updated_at();

drop trigger if exists catalog_field_options_touch on public.catalog_field_options;
create trigger catalog_field_options_touch
  before update on public.catalog_field_options
  for each row execute procedure public.touch_catalog_updated_at();

drop trigger if exists catalog_subcategory_schema_touch on public.catalog_subcategory_schema;
create trigger catalog_subcategory_schema_touch
  before update on public.catalog_subcategory_schema
  for each row execute procedure public.touch_catalog_updated_at();

