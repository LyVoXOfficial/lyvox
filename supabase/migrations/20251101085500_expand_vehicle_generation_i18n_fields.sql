-- Expand vehicle_generation_i18n with deep descriptive fields for localization

begin;

-- Guard when table is not yet created (run 20251026230000_add_vehicle_i18n.sql first)
alter table if exists public.vehicle_generation_i18n
  add column if not exists pros text[] default '{}',
  add column if not exists cons text[] default '{}',
  add column if not exists inspection_tips text[] default '{}',
  add column if not exists common_issues text[] default '{}';

commit;
