begin;

insert into public.vehicle_makes (id, slug, name_en, country, segment_class, is_active, category_path)
values (
  '5d686573-d76c-dc75-e31c-38ae0e227573',
  'amc',
  'AMC',
  'USA',
  'S',
  false,
  'Passenger Cars'
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
  '54e825db-8a7e-e9c7-7ad2-821c9f7b6dd2',
  '5d686573-d76c-dc75-e31c-38ae0e227573',
  'eagle',
  'Eagle',
  1980,
  1988,
  '{1980,1981,1982,1983,1984,1985,1986,1987,1988}'::int[],
  '["Wagon","Sedan","Coupe"]'::jsonb,
  '["Gasoline"]'::jsonb,
  '["Automatic","Manual"]'::jsonb,
  8,
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
  '1f211420-8da7-e0e6-cf5d-1386ff841c35',
  '54e825db-8a7e-e9c7-7ad2-821c9f7b6dd2',
  '1st Gen',
  1980,
  1988,
  false,
  '{"USA"}'::text[],
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'The AMC Eagle was the first mass-produced American four-wheel-drive passenger car, blending sedan comfort with rugged 4x4 capability, preceding the SUV boom.'
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
  '54e825db-8a7e-e9c7-7ad2-821c9f7b6dd2',
  '["Высокая проходимость для легкового автомобиля","Надежный 4.2L двигатель (рядная шестерка)","Уникальный дизайн"]'::jsonb,
  '["Коррозия кузова","Сложности с поиском запчастей","Высокий расход топлива"]'::jsonb,
  '["Проверить состояние трансмиссии и раздаточной коробки","Осмотреть лонжероны на предмет ржавчины","Проверить работу 4WD"]'::jsonb,
  '["Standard All-Wheel Drive (AWD)","Unibody construction","High ground clearance"]'::jsonb,
  '["4.2L I6","2.5L I4"]'::jsonb,
  '[{"engine_code":"4.2L I6 (258)","common_issues_ru":["Проблемы с карбюратором","Износ сальников коленвала","Утечки масла"]}]'::jsonb,
  null,
  null
)
on conflict (model_id) do nothing;

commit;