begin;

insert into public.vehicle_makes (id, slug, name_en, country, segment_class, is_active, category_path)
values (
  'd953d91c-311d-a781-2d7b-2c5913d147ae',
  'alpina',
  'Alpina',
  'Germany',
  'Performance/Luxury',
  true,
  'Luxury Cars/Performance Division'
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
  '412cdb97-8a55-4dc7-0f84-039611300def',
  'd953d91c-311d-a781-2d7b-2c5913d147ae',
  'b3',
  'B3',
  2013,
  2024,
  '{2013,2015,2017,2019,2021,2024}'::int[],
  '["Sedan","Touring"]'::jsonb,
  '["Gasoline"]'::jsonb,
  '["Automatic"]'::jsonb,
  8,
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
  'b5fe1a8f-c1b3-b91b-e491-2d8d1d9b9065',
  '412cdb97-8a55-4dc7-0f84-039611300def',
  'F30/F31',
  2013,
  2019,
  false,
  '{"Germany"}'::text[],
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'High-performance version of the BMW 3-series (F30 generation), known for combining robust power and luxurious long-distance comfort.'
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
  'd1bfa254-89ba-092b-867a-a1a39d8b3520',
  '412cdb97-8a55-4dc7-0f84-039611300def',
  'G20/G21',
  2019,
  2024,
  true,
  '{"Germany"}'::text[],
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'Current generation based on the BMW G20 series, featuring improved dynamics and mild-hybrid technology in later years.'
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
  '412cdb97-8a55-4dc7-0f84-039611300def',
  '["Мощный, но эластичный двигатель","Идеальный баланс между спортом и комфортом подвески","Эксклюзивность и высокая ликвидность"]'::jsonb,
  '["Высокая стоимость обслуживания","Ограниченное количество официальных сервисных центров","Высокий налог на роскошь"]'::jsonb,
  '["Проверить состояние турбокомпрессоров и интеркулера","Оценить износ тормозной системы (часто усиленной)","Диагностика АКПП (ZF 8HP) на предмет рывков"]'::jsonb,
  '["Alpina Switch-Tronic transmission","Signature 20-spoke forged wheels","Custom luxury interior trim"]'::jsonb,
  '["3.0L Inline-six Bi-Turbo (N55 derived)","3.0L Inline-six Bi-Turbo (S58 derived)"]'::jsonb,
  '[{"engine_code":"N55","common_issues_ru":["Проблемы с ТНВД (топливный насос высокого давления)","Течи масла из-под клапанной крышки и поддона"]},{"engine_code":"S58 (B3 2019+)","common_issues_ru":["Высокая чувствительность к качеству топлива","Сложности с обслуживанием системы охлаждения"]}]'::jsonb,
  null,
  null
)
on conflict (model_id) do nothing;

commit;