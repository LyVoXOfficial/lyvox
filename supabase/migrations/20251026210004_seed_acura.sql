begin;

insert into public.vehicle_makes (id, slug, name_en, country, segment_class, is_active, category_path)
values (
  '6e681b80-4a1b-a386-d9be-abbad0b25196',
  'acura',
  'Acura',
  'Japan',
  'Luxury',
  true,
  'Luxury Car/SUV'
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
  'c3c5c024-0f34-c11b-7b85-0aabadcd0bad',
  '6e681b80-4a1b-a386-d9be-abbad0b25196',
  'mdx',
  'MDX',
  2000,
  2024,
  '{2000,2005,2010,2015,2020,2024}'::int[],
  '["SUV"]'::jsonb,
  '["Gasoline"]'::jsonb,
  '["Automatic"]'::jsonb,
  8.8,
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
  'e9ecc85f-623d-0ccd-5897-dd03a48e70f8',
  'c3c5c024-0f34-c11b-7b85-0aabadcd0bad',
  'YD1',
  2000,
  2006,
  false,
  '{"Canada"}'::text[],
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'First generation MDX based on the Honda Global Mid-Size Platform.'
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
  'db3436b5-bcb3-f5a4-9876-931e980d22f8',
  'c3c5c024-0f34-c11b-7b85-0aabadcd0bad',
  'YD3',
  2013,
  2020,
  true,
  '{"USA"}'::text[],
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'Third generation, focusing on lighter weight and improved fuel economy.'
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
  'c3c5c024-0f34-c11b-7b85-0aabadcd0bad',
  '["Высокая надежность двигателя J-серии","Комфортная и энергоемкая подвеска","Просторный и качественно собранный салон"]'::jsonb,
  '["Высокий налог на объемные двигатели","Слабое лакокрасочное покрытие","Дороговизна оригинальных запчастей"]'::jsonb,
  '["Проверить состояние автоматической коробки передач, особенно на моделях до 2007 года.","Прослушать двигатель на наличие посторонних шумов, связанных с VTEC.","Осмотреть состояние карданного вала и заднего редуктора (SH-AWD)."]'::jsonb,
  '["SH-AWD (Super Handling All-Wheel Drive)","Третий ряд сидений","Надежные атмосферные V6 двигатели"]'::jsonb,
  '["J35A3","J35Y5"]'::jsonb,
  '[{"engine_code":"J35A9","common_issues_ru":["Проблемы с автоматической трансмиссией (особенно 5-ступенчатой)","Износ муфты VTEC","Выход из строя катушек зажигания"]},{"engine_code":"J35Y5","common_issues_ru":["Вибрации из-за системы деактивации цилиндров VCM (на ранних моделях)","Течь насоса ГУР"]}]'::jsonb,
  null,
  null
)
on conflict (model_id) do nothing;

commit;