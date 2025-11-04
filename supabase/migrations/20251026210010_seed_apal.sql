begin;

insert into public.vehicle_makes (id, slug, name_en, country, segment_class, is_active, category_path)
values (
  '80eb6a30-bf92-bf92-cd5c-eafbac729922',
  'apal',
  'Apal',
  'Belgium',
  'Niche/Kit Car',
  false,
  'kit_cars/historical'
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
  'a0b0c903-4800-956d-ced6-48f77b917ed7',
  '80eb6a30-bf92-bf92-cd5c-eafbac729922',
  'speedster',
  'Speedster',
  1961,
  1973,
  '{1961,1962,1963,1964,1965,1966,1967,1968,1969,1970,1971,1972,1973}'::int[],
  '["Roadster","Cabriolet"]'::jsonb,
  '["Gasoline"]'::jsonb,
  '["Manual"]'::jsonb,
  6.5,
  5
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
  '8e190eb1-c121-c955-e67e-ecd11f72ed93',
  'a0b0c903-4800-956d-ced6-48f77b917ed7',
  'Type 1',
  1961,
  1973,
  false,
  '{"Belgium"}'::text[],
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'Fiberglas body on Volkswagen Beetle chassis, mimicking the Porsche 356 Speedster.'
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
  'a0b0c903-4800-956d-ced6-48f77b917ed7',
  '["Classic looks","Simple mechanics (VW)","High customizability"]'::jsonb,
  '["Poor insulation","Low crash safety","Finding original parts is difficult"]'::jsonb,
  '["Check the fiberglass body condition thoroughly for cracks or repairs.","Verify chassis integrity and donor vehicle documentation.","Inspect electrical system often prone to wear."]'::jsonb,
  '[]'::jsonb,
  '["VW 1.2L H4","VW 1.6L H4"]'::jsonb,
  '[{"engine_code":"H4 AC","common_issues_ru":["Перегрев при длительных нагрузках","Течи масла из-под штанг толкателей","Износ карбюратора"]}]'::jsonb,
  null,
  null
)
on conflict (model_id) do nothing;

commit;