begin;

insert into public.vehicle_makes (id, slug, name_en, country, segment_class, is_active, category_path)
values (
  '281dd4ff-3f8e-a3d0-f254-d6d75840aba1',
  'auto-union',
  'Auto Union',
  'Germany',
  'A (Historic Compact)',
  false,
  'Historic Vehicles/European'
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
  '0cced48d-b9e3-5a64-620f-c88d21bc6f6f',
  '281dd4ff-3f8e-a3d0-f254-d6d75840aba1',
  '1000',
  'Auto Union 1000',
  1958,
  1963,
  '{1958,1959,1960,1961,1962,1963}'::int[],
  '["Sedan","Wagon","Coupe"]'::jsonb,
  '["Petrol"]'::jsonb,
  '["Manual"]'::jsonb,
  6,
  7
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
  'dc43a478-ddf8-f735-971e-8ae17898aeaf',
  '0cced48d-b9e3-5a64-620f-c88d21bc6f6f',
  'F1000',
  1958,
  1963,
  false,
  '{"West Germany"}'::text[],
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'The Auto Union 1000 was a continuation and development of the DKW three-cylinder line, marking the use of the Auto Union badge prominently.'
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
  '0cced48d-b9e3-5a64-620f-c88d21bc6f6f',
  '["Unique two-stroke engine sound","Front-wheel drive (advanced for its time)","Simple, robust construction"]'::jsonb,
  '["High oil consumption due to two-stroke design","Foul smelling exhaust","Low power output"]'::jsonb,
  '["Check for rust in the frame and body seams","Verify proper operation of the free wheel mechanism","Inspect two-stroke oil mixing system"]'::jsonb,
  '["Standard front-wheel drive","Three-cylinder two-stroke engine","Optional Saxomat automatic clutch"]'::jsonb,
  '["981cc two-stroke I3"]'::jsonb,
  '[{"engine_code":"981cc two-stroke I3","common_issues_ru":["Частое загрязнение свечей зажигания","Износ коренных подшипников коленчатого вала","Проблемы с настройкой карбюратора"]}]'::jsonb,
  null,
  null
)
on conflict (model_id) do nothing;

commit;