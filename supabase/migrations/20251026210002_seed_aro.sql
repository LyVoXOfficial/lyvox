begin;

insert into public.vehicle_makes (id, slug, name_en, country, segment_class, is_active, category_path)
values (
  '16347f7a-2201-4cac-2b2e-de804069d895',
  'aro',
  'ARO',
  'Romania',
  'Off-road/SUV',
  false,
  'Off-road vehicles'
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
  '7a4c5987-2d7b-cacd-d013-a7430b9f1094',
  '16347f7a-2201-4cac-2b2e-de804069d895',
  'aro-24-series',
  'ARO 24 Series',
  1972,
  2006,
  '{1972,1973,1974,1975,1976,1977,1978,1979,1980,1981,1982,1983,1984,1985,1986,1987,1988,1989,1990,1991,1992,1993,1994,1995,1996,1997,1998,1999,2000,2001,2002,2003,2004,2005,2006}'::int[],
  '["SUV","Pickup Truck","Convertible"]'::jsonb,
  '["Gasoline","Diesel"]'::jsonb,
  '["Manual"]'::jsonb,
  4,
  6.5
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
  '047e38ac-e6e7-57ce-a153-069ffef0f0e1',
  '7a4c5987-2d7b-cacd-d013-a7430b9f1094',
  '240-244',
  1972,
  2006,
  false,
  '{"Romania","Portugal"}'::text[],
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'The main series of ARO, widely used for military and civilian purposes, known for its ruggedness and versatility.'
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
  '7a4c5987-2d7b-cacd-d013-a7430b9f1094',
  '["Extremely robust chassis and suspension","High off-road capability","Simple and repairable design"]'::jsonb,
  '["Poor corrosion resistance","Low comfort levels","Outdated engines and high fuel consumption"]'::jsonb,
  '["Inspect frame rails for severe rust","Check all drivetrain components for excessive play","Verify condition of original electrical wiring"]'::jsonb,
  '["Rugged ladder chassis","Switchable 4x4 system","High ground clearance"]'::jsonb,
  '["ARO L25 (2.5L Gas)","Andoria 4C90 (2.4L Diesel)"]'::jsonb,
  '[{"engine_code":"L25","common_issues_ru":["Проблемы с карбюратором и зажиганием","Перегрев при длительной нагрузке"]},{"engine_code":"4C90","common_issues_ru":["Утечки масла","Чувствительность к качеству топлива","Проблемы с ГБЦ"]}]'::jsonb,
  null,
  null
)
on conflict (model_id) do nothing;

commit;