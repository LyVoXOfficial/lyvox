begin;

insert into public.vehicle_makes (id, slug, name_en, country, segment_class, is_active, category_path)
values (
  '5b494f07-e14a-bb29-4571-26b8389bf97f',
  'aston-martin',
  'Aston Martin',
  'United Kingdom',
  'Luxury Sports Car/GT',
  true,
  '/sports-cars/luxury-gt'
)
on conflict do nothing;

insert into public.vehicle_models (
  id,
  make_id,
  slug,
  name_en,
  first_model_year,
  last_model_year,
  years_available,
  body_types_available,
  fuel_types_available,
  transmission_available,
  reliability_score,
  popularity_score
)
values (
  'aad69794-a0bd-9316-85c9-136fbd3f28f3',
  '5b494f07-e14a-bb29-4571-26b8389bf97f',
  'db9',
  'DB9',
  2004,
  2016,
  '{2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016}'::int[],
  '["Coupe","Volante (Convertible)"]'::jsonb,
  '["Gasoline"]'::jsonb,
  '["Automatic","Manual"]'::jsonb,
  6.5,
  7.5
)
on conflict (make_id, slug) do nothing;

insert into public.vehicle_generations (
  id,
  model_id,
  code,
  start_year,
  end_year,
  facelift,
  production_countries,
  body_types,
  fuel_types,
  transmission_types,
  summary
)
values (
  'b0167131-0c0d-02bf-35b1-ce7701452261',
  'aad69794-a0bd-9316-85c9-136fbd3f28f3',
  'AM1',
  2004,
  2012,
  false,
  '{"United Kingdom"}'::text[],
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'Original release using the VH platform, featuring the potent 5.9L V12 engine.'
)
on conflict (model_id, code) do nothing;

insert into public.vehicle_generations (
  id,
  model_id,
  code,
  start_year,
  end_year,
  facelift,
  production_countries,
  body_types,
  fuel_types,
  transmission_types,
  summary
)
values (
  '96d1d1b2-47be-4511-48ad-b3f222c659da',
  'aad69794-a0bd-9316-85c9-136fbd3f28f3',
  'AM1_FL',
  2013,
  2016,
  true,
  '{"United Kingdom"}'::text[],
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'Significant styling and structural revisions, including the updated 510 hp engine (DB9 GT).'
)
on conflict (model_id, code) do nothing;

insert into public.vehicle_insights (
  model_id,
  pros,
  cons,
  inspection_tips,
  notable_features,
  engine_examples,
  common_issues_by_engine,
  reliability_score,
  popularity_score
)
values (
  'aad69794-a0bd-9316-85c9-136fbd3f28f3',
  '["Потрясающий вневременной дизайн","Мощный звук двигателя V12","Высококачественный кожаный салон","Отличный комфорт для GT"]'::jsonb,
  '["Очень высокие эксплуатационные расходы","Устаревшая информационно-развлекательная система (до рестайлинга)","Известные проблемы с электрическими компонентами","Относительно медленная автоматизированная механическая трансмиссия (Sportshift)"]'::jsonb,
  '["Проверить на наличие ржавчины на порогах и внутренних колесных арках.","Осмотреть систему охлаждения на предмет утечек (водяной насос/шланги).","Убедиться в надлежащем функционировании всех электрических компонентов и приборов.","Проверить состояние втулок передней подвески."]'::jsonb,
  '["VH Architecture","Brembo Brakes","V12 Engine"]'::jsonb,
  '["5.9L V12 (450 hp - 510 hp)"]'::jsonb,
  '[{"engine_code":"AM11 (V12 5.9L)","common_issues_ru":["Проблемы с датчиками положения дроссельной заслонки","Сбои в работе системы охлаждения (утечки)","Износ катушек зажигания и свечей","Дорогостоящее обслуживание сцепления (на механике)"]}]'::jsonb,
  null,
  null
)
on conflict (model_id) do nothing;

commit;