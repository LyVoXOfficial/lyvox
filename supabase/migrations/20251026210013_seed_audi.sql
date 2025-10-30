begin;

insert into public.vehicle_makes (id, slug, name_en, country, segment_class, is_active, category_path)
values (
  'b5a343da-2fc6-32f4-7f83-63bac8bebd76',
  'audi',
  'Audi',
  'Germany',
  'Premium',
  true,
  'Premium/Luxury Cars'
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
  'bcc1c9e9-6bdc-a6f0-809a-08ecb5aac77e',
  'b5a343da-2fc6-32f4-7f83-63bac8bebd76',
  'a4-b9',
  'A4',
  2015,
  2024,
  '{2015,2016,2017,2018,2019,2020,2021,2022,2023,2024}'::int[],
  '["Sedan","Avant (Wagon)","Allroad"]'::jsonb,
  '["Gasoline","Diesel","Hybrid"]'::jsonb,
  '["Manual","Automatic (S tronic)","Automatic (Tiptronic)"]'::jsonb,
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
  '29eeaa46-263d-95dd-f06a-7fbeac1ca66f',
  'bcc1c9e9-6bdc-a6f0-809a-08ecb5aac77e',
  'B9 (Typ 8W)',
  2015,
  2023,
  false,
  '{"Germany","China"}'::text[],
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'Fifth generation of the A4, based on the MLB Evo platform, known for its extensive technology and improved efficiency.'
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
  'bcc1c9e9-6bdc-a6f0-809a-08ecb5aac77e',
  '["Высокое качество отделки салона","Отличная шумоизоляция","Экономичность дизельных и бензиновых моторов"]'::jsonb,
  '["Дорогое обслуживание у официального дилера","Склонность к отказам электроники (MMI)","Проблемы с мехатроником S Tronic на ранних моделях"]'::jsonb,
  '["Проверить состояние DSG (S Tronic) при переключении передач","Оценить работу всех электронных систем (MMI, Virtual Cockpit)","Проверить подвеску на предмет износа сайлентблоков"]'::jsonb,
  '["Virtual Cockpit","Matrix LED headlights","Quattro Ultra AWD system"]'::jsonb,
  '["2.0 TFSI","3.0 TDI"]'::jsonb,
  '[{"engine_code":"EA888 Gen 3 (2.0 TFSI)","common_issues_ru":["Проблемы с помпой охлаждения","Накопление нагара на впускных клапанах","Сбои в работе термостата"]}]'::jsonb,
  null,
  null
)
on conflict (model_id) do nothing;

commit;