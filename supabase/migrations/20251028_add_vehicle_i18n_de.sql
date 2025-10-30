-- Expand vehicle i18n locale support to include 'de'
-- Also safe-drop existing CHECK constraints on locale and recreate with extended set

begin;

-- Drop existing locale CHECK constraints if tables exist (safe even when absent)
do $$
declare r record;
begin
  for r in (
    select conname, (c.oid)::regclass as tbl
    from pg_constraint
    join pg_class c on c.oid = pg_constraint.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where pg_constraint.contype = 'c'
      and n.nspname = 'public'
      and c.relname in ('vehicle_make_i18n','vehicle_model_i18n','vehicle_generation_i18n')
      and pg_get_constraintdef(pg_constraint.oid) ilike '%locale%'
  ) loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

-- Recreate explicit named constraints with 'de' included, only if table exists
do $$ begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='vehicle_make_i18n') then
    alter table public.vehicle_make_i18n
      add constraint vehicle_make_i18n_locale_check
      check (locale in ('en','fr','nl','ru','de'));
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='vehicle_model_i18n') then
    alter table public.vehicle_model_i18n
      add constraint vehicle_model_i18n_locale_check
      check (locale in ('en','fr','nl','ru','de'));
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='vehicle_generation_i18n') then
    alter table public.vehicle_generation_i18n
      add constraint vehicle_generation_i18n_locale_check
      check (locale in ('en','fr','nl','ru','de'));
  end if;
end $$;

commit;
