begin;

insert into public.vehicle_makes (id, slug, name_en, country, segment_class, is_active, category_path)
values (
  '025116be-7b04-0880-0f2c-528b618f1c84',
  'alpine',
  'Alpine',
  'France',
  'S - Sports Car',
  true,
  'Sportscars/Luxury'
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
  '1435da4b-d133-43fe-9e03-c18178bda98e',
  '025116be-7b04-0880-0f2c-528b618f1c84',
  'a110',
  'A110',
  2017,
  2024,
  '{2017,2018,2019,2020,2021,2022,2023,2024}'::int[],
  '["Coupe"]'::jsonb,
  '["Gasoline"]'::jsonb,
  '["Automatic (DCT)"]'::jsonb,
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
  'b2cafb1b-4010-930f-261e-370152b8cf6e',
  '1435da4b-d133-43fe-9e03-c18178bda98e',
  'II',
  2017,
  2024,
  false,
  '{"France"}'::text[],
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'Modern lightweight sports coupe reviving the iconic nameplate.'
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
  '1435da4b-d133-43fe-9e03-c18178bda98e',
  '["Outstanding handling and agility","Lightweight design","Distinctive styling","High performance"]'::jsonb,
  '["High cost of ownership","Limited practicality (two-seater, small storage)","Interior quality sometimes questioned","Limited distribution network"]'::jsonb,
  '["Check aluminum body panels for impact damage","Inspect DCT gearbox for smooth operation, especially under load","Ensure regular maintenance records are present, particularly regarding engine oil changes."]'::jsonb,
  '["Aluminum chassis","Mid-engine layout","Getrag 7-speed DCT gearbox"]'::jsonb,
  '["1.8 TCe (M5P)"]'::jsonb,
  '[{"engine_code":"M5P 1.8L Turbo","common_issues_ru":["Перегрев масла в DCT при агрессивной езде","Незначительные проблемы с электрикой/датчиками","Потенциальный износ тормозных дисков при трековой эксплуатации"]}]'::jsonb,
  null,
  null
)
on conflict (model_id) do nothing;

commit;