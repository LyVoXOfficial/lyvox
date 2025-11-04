begin;

insert into public.vehicle_makes (id, slug, name_en, country, segment_class, is_active, category_path)
values (
  'd86e1e87-46b9-118c-ba54-8a3b147075bf',
  'abarth',
  'Abarth',
  'Italy',
  'Sport Hatch / Roadster',
  true,
  'Sportscars'
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
  '863c44b3-968c-ecc9-f3c6-5e1556965aa4',
  'd86e1e87-46b9-118c-ba54-8a3b147075bf',
  'abarth-595',
  '595 / 695',
  2016,
  2024,
  '{2016,2017,2018,2019,2020,2021,2022,2023,2024}'::int[],
  '["Hatchback","Convertible"]'::jsonb,
  '["Gasoline"]'::jsonb,
  '["Manual","Automatic (Robotized)"]'::jsonb,
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
  '987df6cf-bd93-eab4-a8ec-447a6f5be639',
  '863c44b3-968c-ecc9-f3c6-5e1556965aa4',
  'Type 312',
  2008,
  2024,
  true,
  '{"Poland","Mexico"}'::text[],
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'High-performance variant of the Fiat 500, continuously updated, known for its small size, agile handling, and aggressive exhaust note.'
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
  '863c44b3-968c-ecc9-f3c6-5e1556965aa4',
  '["Excellent handling and agility","Unique and attractive styling","Exciting driving experience","Loud, characterful exhaust note"]'::jsonb,
  '["Stiff ride quality","Limited interior space","Dated interior ergonomics on older models","High fuel consumption when driven hard"]'::jsonb,
  '["Check for excessive wear on front brakes and tires due to aggressive driving.","Listen for unusual noises from the robotized transmission (MTA).","Inspect suspension components for signs of leakage or damage due to hard use."]'::jsonb,
  '["Garrett Turbocharger","Koni FSD dampers","Record Monza exhaust system"]'::jsonb,
  '["1.4 T-Jet (145 hp - 180 hp)"]'::jsonb,
  '[{"engine_code":"312 A3.000 (1.4 T-Jet)","common_issues_ru":["Проблемы с датчиком давления наддува","Утечки масла из турбокомпрессора","Износ актуатора роботизированной КПП (MTA)"]}]'::jsonb,
  null,
  null
)
on conflict (model_id) do nothing;

commit;