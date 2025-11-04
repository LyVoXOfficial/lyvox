begin;

insert into public.vehicle_makes (id, slug, name_en, country, segment_class, is_active, category_path)
values (
  'bd29e402-b98c-e579-5c6e-af58f2972064',
  'aixam',
  'Aixam',
  'France',
  'Microcar',
  true,
  'Passenger Car'
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
  '9016363a-6d44-f53d-d9aa-609662a90f4c',
  'bd29e402-b98c-e579-5c6e-af58f2972064',
  'city-minauto',
  'City / Minauto',
  2008,
  2024,
  '{2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024}'::int[],
  '["Hatchback","Microcar"]'::jsonb,
  '["Diesel","Electric"]'::jsonb,
  '["Automatic (CVT)"]'::jsonb,
  7,
  8
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
  '8654acdf-b4d8-d1be-f635-18ee0d9b0336',
  '9016363a-6d44-f53d-d9aa-609662a90f4c',
  'E6',
  2010,
  2020,
  false,
  '{"France"}'::text[],
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'Modern design evolution focusing on improved comfort and equipment options.'
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
  '9016363a-6d44-f53d-d9aa-609662a90f4c',
  '["Extremely low fuel consumption","Can be driven without a standard license (in many EU countries)","Easy parking in urban areas"]'::jsonb,
  '["Low safety rating (compared to full-sized cars)","Very limited power and speed","High price relative to size"]'::jsonb,
  '["Часто проверяйте состояние ремня вариатора","Осмотрите пластиковые кузовные панели на наличие трещин","Проверьте опоры двигателя на предмет чрезмерной вибрации"]'::jsonb,
  '["Light quadricycle class","CVT transmission"]'::jsonb,
  '["Kubota Z482 (Diesel)","Lombardini HDi (Diesel)"]'::jsonb,
  '[{"engine_code":"Z482","common_issues_ru":["Проблемы с ТНВД (топливным насосом высокого давления)","Перегрев при длительной нагрузке","Быстрый износ ремня ГРМ"]}]'::jsonb,
  null,
  null
)
on conflict (model_id) do nothing;

commit;