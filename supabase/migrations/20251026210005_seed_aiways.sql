begin;

insert into public.vehicle_makes (id, slug, name_en, country, segment_class, is_active, category_path)
values (
  'aa64b47c-daa3-9b9f-272c-897f1df88db4',
  'aiways',
  'Aiways',
  'China',
  'C-SUV',
  true,
  'Passenger Vehicles / EV Brands'
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
  'df8710db-bd09-250d-8a17-b8cbe983969a',
  'aa64b47c-daa3-9b9f-272c-897f1df88db4',
  'u5',
  'U5',
  2019,
  2024,
  '{2019,2020,2021,2022,2023,2024}'::int[],
  '["SUV"]'::jsonb,
  '["Electric"]'::jsonb,
  '["Automatic (Single Speed)"]'::jsonb,
  7.5,
  8.5
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
  'fef400a4-9cfb-d81b-45fc-4390dd8b9aa2',
  'df8710db-bd09-250d-8a17-b8cbe983969a',
  'Gen1',
  2019,
  2024,
  false,
  '{"China"}'::text[],
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'First generation of Aiways'' flagship electric SUV, known for its decent range and spacious interior.'
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
  'df8710db-bd09-250d-8a17-b8cbe983969a',
  '["Хороший запас хода (для своего класса)","Просторный салон и большой багажник","Современные технологии и минималистичный дизайн"]'::jsonb,
  '["Ограниченная дилерская и сервисная сеть","Чувствительность к морозам (батарея)"]'::jsonb,
  '["Проверить состояние высоковольтной батареи (SOH)","Осмотреть кузов на предмет ржавчины в скрытых полостях","Проверить корректность работы адаптивного круиз-контроля"]'::jsonb,
  '["Advanced structural safety design","Mobile power station function"]'::jsonb,
  '["63 kWh battery pack"]'::jsonb,
  '[{"engine_code":"A63","common_issues_ru":["Сбои программного обеспечения мультимедийной системы","Быстрый разряд при низких температурах (аккумулятор)","Проблемы с датчиками давления в шинах"]}]'::jsonb,
  null,
  null
)
on conflict (model_id) do nothing;

commit;