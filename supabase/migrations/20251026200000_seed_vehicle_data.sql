-- AUTO-GENERATED SEED FOR vehicle_* TABLES;

begin;

insert into public.vehicle_makes (id, slug, name_en, country, segment_class, is_active, category_path)
values (
  '7a6ce6c8-456e-e5c7-d770-84174939ca14',
  'ac-cars',
  'AC Cars',
  'UK',
  'S',
  true,
  'Sportscars / Classic'
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
  'd5623743-b84b-68c1-ad22-81ce143cb080',
  '7a6ce6c8-456e-e5c7-d770-84174939ca14',
  'cobra',
  'Cobra',
  1962,
  2024,
  '{1962,1963,1964,1965,1966,1967,1982,1990,2000,2010,2020,2024}'::int[],
  '["Roadster","Coupe"]'::jsonb,
  '["Gasoline"]'::jsonb,
  '["Manual"]'::jsonb,
  4,
  9.5
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
  'f615eed4-ca52-7eb9-519e-7d59ed0f646b',
  'd5623743-b84b-68c1-ad22-81ce143cb080',
  'Cobra Mk I/II/III',
  1962,
  1967,
  false,
  '{"UK","USA"}'::text[],
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'The original Anglo-American collaboration featuring Ford V8 engines.'
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
  '7e88a778-3a8e-7dcf-4090-14ba7d76d3a2',
  'd5623743-b84b-68c1-ad22-81ce143cb080',
  'Cobra Mk IV/V (Continuation/Replica)',
  1982,
  2024,
  true,
  '{"UK"}'::text[],
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'Modern continuation and specialized versions.'
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
  'd5623743-b84b-68c1-ad22-81ce143cb080',
  '["Выдающаяся динамика и звук V8","Стабильный рост коллекционной стоимости","Простота конструкции (доступность ремонта)"]'::jsonb,
  '["Крайне высокая стоимость приобретения и обслуживания (для оригиналов)","Практически полное отсутствие систем безопасности и комфорта","Очень требовательна к качеству топлива и масла","Сложности с регистрацией в некоторых странах ЕС/СНГ"]'::jsonb,
  '["Подтверждение подлинности шасси (важно для Mk I-III)","Оценка качества сборки и сварки рамы (особенно у реплик/продолжений)","Проверка состояния дифференциала и трансмиссии на предмет износа от высокой мощности","Проверка работы тормозной системы, которая часто модернизируется"]'::jsonb,
  '["Легендарный дизайн Кэрролла Шелби","Чрезвычайно высокое соотношение мощности к весу","Коллекционная ценность"]'::jsonb,
  '["Ford 289 V8","Ford 427 V8","Roush/Modern 5.0 V8"]'::jsonb,
  '[{"engine_code":"Ford 427 FE V8","common_issues_ru":["Сложности с поддержанием температурного режима (перегрев)","Износ поршневых групп при агрессивной эксплуатации","Утечки масла через прокладки","Необходимость точной настройки карбюратора"]},{"engine_code":"Ford 289 V8","common_issues_ru":["Проблемы с системой зажигания","Слабость оригинальных систем охлаждения"]}]'::jsonb,
  null,
  null
)
on conflict (model_id) do nothing;

-- ... (rest of the file content) ...

commit;