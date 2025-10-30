begin;

insert into public.vehicle_makes (id, slug, name_en, country, segment_class, is_active, category_path)
values (
  'fe0418b6-c803-b9e5-aaf0-42cc443ef3b2',
  'ariel',
  'Ariel',
  'UK',
  'Niche/Track Car',
  true,
  '/sports-cars'
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
  'e7aa9b4d-4d0f-5f46-b575-12fce494674c',
  'fe0418b6-c803-b9e5-aaf0-42cc443ef3b2',
  'atom',
  'Atom',
  2000,
  2024,
  '{2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024}'::int[],
  '["Roadster"]'::jsonb,
  '["Gasoline"]'::jsonb,
  '["Manual"]'::jsonb,
  8,
  9
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
  '36feac61-2b3c-0578-865f-d3f4ea425a47',
  'e7aa9b4d-4d0f-5f46-b575-12fce494674c',
  'Atom 1',
  2000,
  2003,
  false,
  '{"UK"}'::text[],
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'Original generation featuring Rover K-Series engine.'
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
  'a48ce152-4c4e-af1c-564e-d99aba65de31',
  'e7aa9b4d-4d0f-5f46-b575-12fce494674c',
  'Atom 3',
  2007,
  2017,
  true,
  '{"UK"}'::text[],
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'Major revision utilizing Honda K20Z engines.'
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
  '87b21a0d-9186-1e87-4afe-81c491503d01',
  'e7aa9b4d-4d0f-5f46-b575-12fce494674c',
  'Atom 4',
  2018,
  2024,
  false,
  '{"UK"}'::text[],
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'Latest generation with significant chassis and handling improvements, using Honda Civic Type R (K20C) engine.'
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
  'e7aa9b4d-4d0f-5f46-b575-12fce494674c',
  '["Невероятная динамика и управляемость","Ощущение гоночного автомобиля на дороге","Легкость обслуживания двигателя"]'::jsonb,
  '["Отсутствие комфорта и защиты от непогоды","Высокий дорожный налог и страховка","Очень непрактичен для ежедневного использования"]'::jsonb,
  '["Проверить шасси на следы повреждений или ремонта после аварий/трек-дней","Осмотреть открытые элементы подвески на предмет износа и ржавчины","Проверить историю обслуживания двигателя Honda"]'::jsonb,
  '["Exoskeletal chassis design","Exceptional power-to-weight ratio","Honda reliability paired with extreme performance"]'::jsonb,
  '["Honda K20Z4 (Supercharged)","Honda K20C (Turbo)"]'::jsonb,
  '[{"engine_code":"K20Z4 (Supercharged)","common_issues_ru":["Проблемы с датчиком VTEC","Повышенный износ трансмиссии из-за высоких нагрузок","Склонность к перегреву при длительной трековой эксплуатации"]},{"engine_code":"K20C (Turbo)","common_issues_ru":["Требовательность к качеству масла","Проблемы с электроникой двигателя","Возможное образование трещин в коллекторе"]}]'::jsonb,
  null,
  null
)
on conflict (model_id) do nothing;

commit;