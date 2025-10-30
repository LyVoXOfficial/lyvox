begin;

insert into public.vehicle_makes (id, slug, name_en, country, segment_class, is_active, category_path)
values (
  'ba7f78e5-4434-8fee-d85f-6e233c6b16fd',
  'alfa-romeo',
  'Alfa Romeo',
  'Italy',
  'Premium',
  true,
  'Premium Passenger Vehicles'
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
  '1d45a607-645b-5640-3aa4-343ad4c4e134',
  'ba7f78e5-4434-8fee-d85f-6e233c6b16fd',
  'giulia',
  'Giulia',
  2016,
  2024,
  '{2016,2017,2018,2019,2020,2021,2022,2023,2024}'::int[],
  '["Sedan"]'::jsonb,
  '["Gasoline","Diesel"]'::jsonb,
  '["Automatic","Manual"]'::jsonb,
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
  'ef1c675d-ec16-abab-f737-543165d609aa',
  '1d45a607-645b-5640-3aa4-343ad4c4e134',
  '952',
  2016,
  2024,
  false,
  '{"Italy"}'::text[],
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'Modern rear-wheel-drive sports sedan marking Alfa Romeo''s return to competitive premium segments, known for its dynamic handling.'
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
  '1d45a607-645b-5640-3aa4-343ad4c4e134',
  '["Отличная управляемость","Мощные двигатели (особенно Quadrifoglio)","Стильный дизайн"]'::jsonb,
  '["Проблемы с электроникой на ранних моделях","Высокая стоимость обслуживания","Недостаточно места сзади"]'::jsonb,
  '["Проверить работу информационно-развлекательной системы и датчиков.","Обратить внимание на люфт карданного вала на полноприводных версиях.","Оценить состояние тормозной системы (особенно Quadrifoglio)."]'::jsonb,
  '["Carbon fiber drive shaft","Integrated Brake System (IBS)","DNA drive mode selector"]'::jsonb,
  '["2.0 GME T4 (Gasoline)","2.2 JTDm (Diesel)","2.9 V6 Bi-Turbo (Quadrifoglio)"]'::jsonb,
  '[{"engine_code":"2.0 GME T4","common_issues_ru":["Проблемы с цепью ГРМ (на ранних версиях)","Выход из строя термостата","Сбои в работе системы старт-стоп"]},{"engine_code":"2.2 JTDm","common_issues_ru":["Отказы клапана EGR","Проблемы с сажевым фильтром (при городской эксплуатации)"]}]'::jsonb,
  null,
  null
)
on conflict (model_id) do nothing;

commit;