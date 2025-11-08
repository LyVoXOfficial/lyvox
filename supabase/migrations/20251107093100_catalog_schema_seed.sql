-- CS-002: Seed initial catalog field definitions and schemas
-- Covers representative subcategories across top-level domains.

-- 1. Field definitions ------------------------------------------------------
insert into public.catalog_fields (
  field_key,
  label_i18n_key,
  description_i18n_key,
  field_type,
  domain,
  is_required,
  unit,
  min_value,
  max_value,
  pattern,
  group_key,
  sort,
  metadata
)
values
  -- Furniture (Home)
  ('furniture_material', 'catalog.furniture.material', null, 'select', 'dlya-doma-hobbi-i-detey', true, null, null, null, null, 'furniture_details', 10, '{"widget":"select"}'::jsonb),
  ('furniture_style', 'catalog.furniture.style', null, 'select', 'dlya-doma-hobbi-i-detey', false, null, null, null, null, 'furniture_details', 20, '{"widget":"select"}'::jsonb),
  ('furniture_condition_grade', 'catalog.furniture.condition', 'catalog.furniture.condition.hint', 'select', 'dlya-doma-hobbi-i-detey', true, null, null, null, null, 'furniture_details', 30, '{"widget":"select"}'::jsonb),
  ('furniture_length_cm', 'catalog.furniture.length_cm', null, 'number', 'dlya-doma-hobbi-i-detey', false, 'cm', 0, null, null, 'furniture_dimensions', 10, '{"step":1}'::jsonb),
  ('furniture_width_cm', 'catalog.furniture.width_cm', null, 'number', 'dlya-doma-hobbi-i-detey', false, 'cm', 0, null, null, 'furniture_dimensions', 20, '{"step":1}'::jsonb),
  ('furniture_height_cm', 'catalog.furniture.height_cm', null, 'number', 'dlya-doma-hobbi-i-detey', false, 'cm', 0, null, null, 'furniture_dimensions', 30, '{"step":1}'::jsonb),
  ('furniture_brand', 'catalog.furniture.brand', null, 'text', 'dlya-doma-hobbi-i-detey', false, null, null, null, null, 'furniture_extra', 10, '{"maxLength":120}'::jsonb),
  ('furniture_color', 'catalog.furniture.color', null, 'text', 'dlya-doma-hobbi-i-detey', false, null, null, null, null, 'furniture_extra', 20, '{"maxLength":60}'::jsonb),

  -- Auto parts (Transport)
  ('auto_part_type', 'catalog.auto_parts.type', null, 'select', 'transport', true, null, null, null, null, 'auto_parts_details', 10, '{"widget":"select"}'::jsonb),
  ('auto_part_condition_grade', 'catalog.auto_parts.condition', null, 'select', 'transport', true, null, null, null, null, 'auto_parts_details', 20, '{"widget":"select"}'::jsonb),
  ('auto_part_season', 'catalog.auto_parts.season', null, 'select', 'transport', false, null, null, null, null, 'auto_parts_details', 30, '{"widget":"select"}'::jsonb),
  ('auto_part_diameter_inch', 'catalog.auto_parts.diameter_inch', null, 'number', 'transport', false, 'inch', 10, 30, null, 'auto_parts_spec', 10, '{"step":0.5}'::jsonb),
  ('auto_part_width_mm', 'catalog.auto_parts.width_mm', null, 'number', 'transport', false, 'mm', 100, 400, null, 'auto_parts_spec', 20, '{"step":5}'::jsonb),
  ('auto_part_bolt_pattern', 'catalog.auto_parts.bolt_pattern', 'catalog.auto_parts.bolt_pattern.hint', 'text', 'transport', false, null, null, null, null, 'auto_parts_spec', 30, '{"maxLength":40}'::jsonb),

  -- Services (Услуги и бизнес)
  ('service_scope', 'catalog.services.scope', 'catalog.services.scope.hint', 'textarea', 'uslugi-i-biznes', true, null, null, null, null, 'services_details', 10, '{"rows":3}'::jsonb),
  ('service_rate_type', 'catalog.services.rate_type', null, 'select', 'uslugi-i-biznes', true, null, null, null, null, 'services_pricing', 10, '{"widget":"segmented"}'::jsonb),
  ('service_rate_amount', 'catalog.services.rate_amount', null, 'number', 'uslugi-i-biznes', false, 'EUR', 0, null, null, 'services_pricing', 20, '{"step":5}'::jsonb),
  ('service_location_type', 'catalog.services.location_type', null, 'select', 'uslugi-i-biznes', true, null, null, null, null, 'services_details', 20, '{"widget":"select"}'::jsonb),
  ('service_area', 'catalog.services.area', 'catalog.services.area.hint', 'text', 'uslugi-i-biznes', false, null, null, null, null, 'services_details', 30, '{"maxLength":120}'::jsonb),
  ('service_experience_years', 'catalog.services.experience_years', null, 'number', 'uslugi-i-biznes', false, 'years', 0, 60, null, 'services_quality', 10, '{"step":1}'::jsonb),
  ('service_license', 'catalog.services.license', null, 'boolean', 'uslugi-i-biznes', false, null, null, null, null, 'services_quality', 20, '{}'::jsonb),
  ('service_available_from', 'catalog.services.available_from', null, 'date', 'uslugi-i-biznes', false, null, null, null, null, 'services_availability', 10, '{}'::jsonb),

  -- Pets (Животные)
  ('pet_breed', 'catalog.pets.breed', null, 'text', 'zhivotnye', false, null, null, null, null, 'pets_details', 10, '{"maxLength":120}'::jsonb),
  ('pet_gender', 'catalog.pets.gender', null, 'select', 'zhivotnye', false, null, null, null, null, 'pets_details', 20, '{"widget":"select"}'::jsonb),
  ('pet_age_months', 'catalog.pets.age_months', null, 'number', 'zhivotnye', false, 'months', 0, 240, null, 'pets_details', 30, '{"step":1}'::jsonb),
  ('pet_weight_kg', 'catalog.pets.weight_kg', null, 'number', 'zhivotnye', false, 'kg', 0, 120, null, 'pets_health', 10, '{"step":0.5}'::jsonb),
  ('pet_vaccinated', 'catalog.pets.vaccinated', null, 'boolean', 'zhivotnye', false, null, null, null, null, 'pets_health', 20, '{}'::jsonb),
  ('pet_sterilized', 'catalog.pets.sterilized', null, 'boolean', 'zhivotnye', false, null, null, null, null, 'pets_health', 30, '{}'::jsonb),
  ('pet_microchip', 'catalog.pets.microchip', null, 'boolean', 'zhivotnye', false, null, null, null, null, 'pets_health', 40, '{}'::jsonb),
  ('pet_pedigree', 'catalog.pets.pedigree', null, 'boolean', 'zhivotnye', false, null, null, null, null, 'pets_health', 50, '{}'::jsonb),
  ('pet_character', 'catalog.pets.character', 'catalog.pets.character.hint', 'textarea', 'zhivotnye', false, null, null, null, null, 'pets_extra', 10, '{"rows":3}'::jsonb),

  -- Baby & Kids (Для дома, хобби и детей → Детские товары)
  ('baby_product_category', 'catalog.baby.product_category', null, 'select', 'dlya-doma-hobbi-i-detey', true, null, null, null, null, 'baby_product', 10, '{"widget":"select"}'::jsonb),
  ('baby_age_group', 'catalog.baby.age_group', null, 'select', 'dlya-doma-hobbi-i-detey', true, null, null, null, null, 'baby_product', 20, '{"widget":"select"}'::jsonb),
  ('baby_condition_grade', 'catalog.baby.condition', null, 'select', 'dlya-doma-hobbi-i-detey', true, null, null, null, null, 'baby_condition', 10, '{"widget":"select"}'::jsonb),
  ('baby_brand', 'catalog.baby.brand', null, 'text', 'dlya-doma-hobbi-i-detey', false, null, null, null, null, 'baby_details', 10, '{"maxLength":120}'::jsonb),
  ('baby_color', 'catalog.baby.color', null, 'text', 'dlya-doma-hobbi-i-detey', false, null, null, null, null, 'baby_details', 20, '{"maxLength":60}'::jsonb),
  ('baby_material', 'catalog.baby.material', null, 'text', 'dlya-doma-hobbi-i-detey', false, null, null, null, null, 'baby_details', 30, '{"maxLength":120}'::jsonb),
  ('baby_quantity', 'catalog.baby.quantity', null, 'number', 'dlya-doma-hobbi-i-detey', false, null, 1, 10, null, 'baby_details', 40, '{"step":1}'::jsonb),
  ('baby_safety_certified', 'catalog.baby.safety_certified', null, 'boolean', 'dlya-doma-hobbi-i-detey', false, null, null, null, null, 'baby_safety', 10, '{}'::jsonb),
  ('baby_expiration_date', 'catalog.baby.expiration_date', null, 'date', 'dlya-doma-hobbi-i-detey', false, null, null, null, null, 'baby_safety', 20, '{}'::jsonb),

  -- Giveaway (Особые категории)
  ('giveaway_reason', 'catalog.giveaway.reason', 'catalog.giveaway.reason.hint', 'textarea', 'osobye-kategorii', false, null, null, null, null, 'giveaway_details', 10, '{"rows":2}'::jsonb),
  ('giveaway_condition_grade', 'catalog.giveaway.condition', null, 'select', 'osobye-kategorii', true, null, null, null, null, 'giveaway_details', 20, '{"widget":"select"}'::jsonb),
  ('giveaway_pickup', 'catalog.giveaway.pickup', 'catalog.giveaway.pickup.hint', 'text', 'osobye-kategorii', true, null, null, null, null, 'giveaway_details', 30, '{"maxLength":160}'::jsonb),
  ('giveaway_available_until', 'catalog.giveaway.available_until', null, 'date', 'osobye-kategorii', false, null, null, null, null, 'giveaway_details', 40, '{}'::jsonb),
  ('giveaway_requirements', 'catalog.giveaway.requirements', null, 'textarea', 'osobye-kategorii', false, null, null, null, null, 'giveaway_extra', 10, '{"rows":2}'::jsonb)
on conflict (field_key) do update
set
  label_i18n_key = excluded.label_i18n_key,
  description_i18n_key = excluded.description_i18n_key,
  field_type = excluded.field_type,
  domain = excluded.domain,
  is_required = excluded.is_required,
  unit = excluded.unit,
  min_value = excluded.min_value,
  max_value = excluded.max_value,
  pattern = excluded.pattern,
  group_key = excluded.group_key,
  sort = excluded.sort,
  metadata = excluded.metadata,
  updated_at = now();

-- 2. Field options ----------------------------------------------------------
with
  material_field as (select id from public.catalog_fields where field_key = 'furniture_material'),
  style_field as (select id from public.catalog_fields where field_key = 'furniture_style'),
  furniture_condition_field as (select id from public.catalog_fields where field_key = 'furniture_condition_grade'),
  auto_part_type_field as (select id from public.catalog_fields where field_key = 'auto_part_type'),
  auto_part_condition_field as (select id from public.catalog_fields where field_key = 'auto_part_condition_grade'),
  auto_part_season_field as (select id from public.catalog_fields where field_key = 'auto_part_season'),
  service_rate_type_field as (select id from public.catalog_fields where field_key = 'service_rate_type'),
  service_location_field as (select id from public.catalog_fields where field_key = 'service_location_type'),
  pet_gender_field as (select id from public.catalog_fields where field_key = 'pet_gender'),
  baby_product_category_field as (select id from public.catalog_fields where field_key = 'baby_product_category'),
  baby_age_group_field as (select id from public.catalog_fields where field_key = 'baby_age_group'),
  baby_condition_field as (select id from public.catalog_fields where field_key = 'baby_condition_grade'),
  giveaway_condition_field as (select id from public.catalog_fields where field_key = 'giveaway_condition_grade')

insert into public.catalog_field_options (field_id, code, name_i18n_key, sort)
select * from (
  -- furniture material
  select material_field.id, v.code, v.name_i18n_key, v.sort
  from material_field
  cross join (values
    ('wood', 'catalog.furniture.material_option.wood', 10),
    ('metal', 'catalog.furniture.material_option.metal', 20),
    ('plastic', 'catalog.furniture.material_option.plastic', 30),
    ('glass', 'catalog.furniture.material_option.glass', 40),
    ('fabric', 'catalog.furniture.material_option.fabric', 50),
    ('leather', 'catalog.furniture.material_option.leather', 60),
    ('rattan', 'catalog.furniture.material_option.rattan', 70),
    ('other', 'catalog.furniture.material_option.other', 90)
  ) as v(code, name_i18n_key, sort)

  union all

  -- furniture style
  select style_field.id, v.code, v.name_i18n_key, v.sort
  from style_field
  cross join (values
    ('modern', 'catalog.furniture.style_option.modern', 10),
    ('classic', 'catalog.furniture.style_option.classic', 20),
    ('scandi', 'catalog.furniture.style_option.scandinavian', 30),
    ('loft', 'catalog.furniture.style_option.loft', 40),
    ('minimalism', 'catalog.furniture.style_option.minimalism', 50),
    ('provence', 'catalog.furniture.style_option.provence', 60),
    ('vintage', 'catalog.furniture.style_option.vintage', 70),
    ('other', 'catalog.furniture.style_option.other', 90)
  ) as v(code, name_i18n_key, sort)

  union all

  -- furniture condition grade
  select furniture_condition_field.id, v.code, v.name_i18n_key, v.sort
  from furniture_condition_field
  cross join (values
    ('new', 'catalog.common.condition.new', 10),
    ('excellent', 'catalog.common.condition.excellent', 20),
    ('good', 'catalog.common.condition.good', 30),
    ('needs_repair', 'catalog.common.condition.needs_repair', 40)
  ) as v(code, name_i18n_key, sort)

  union all

  -- auto part type
  select auto_part_type_field.id, v.code, v.name_i18n_key, v.sort
  from auto_part_type_field
  cross join (values
    ('tires', 'catalog.auto_parts.type_option.tires', 10),
    ('wheels', 'catalog.auto_parts.type_option.wheels', 20),
    ('rims', 'catalog.auto_parts.type_option.rims', 30),
    ('accessories', 'catalog.auto_parts.type_option.accessories', 40)
  ) as v(code, name_i18n_key, sort)

  union all

  -- auto part condition
  select auto_part_condition_field.id, v.code, v.name_i18n_key, v.sort
  from auto_part_condition_field
  cross join (values
    ('new', 'catalog.common.condition.new', 10),
    ('excellent', 'catalog.common.condition.excellent', 20),
    ('good', 'catalog.common.condition.good', 30),
    ('used', 'catalog.common.condition.used', 40)
  ) as v(code, name_i18n_key, sort)

  union all

  -- auto part season
  select auto_part_season_field.id, v.code, v.name_i18n_key, v.sort
  from auto_part_season_field
  cross join (values
    ('summer', 'catalog.auto_parts.season_option.summer', 10),
    ('winter', 'catalog.auto_parts.season_option.winter', 20),
    ('all_season', 'catalog.auto_parts.season_option.all_season', 30)
  ) as v(code, name_i18n_key, sort)

  union all

  -- service rate type
  select service_rate_type_field.id, v.code, v.name_i18n_key, v.sort
  from service_rate_type_field
  cross join (values
    ('hourly', 'catalog.services.rate_type_option.hourly', 10),
    ('daily', 'catalog.services.rate_type_option.daily', 20),
    ('project', 'catalog.services.rate_type_option.project', 30),
    ('free_quote', 'catalog.services.rate_type_option.free_quote', 40)
  ) as v(code, name_i18n_key, sort)

  union all

  -- service location type
  select service_location_field.id, v.code, v.name_i18n_key, v.sort
  from service_location_field
  cross join (values
    ('on_site', 'catalog.services.location_type_option.on_site', 10),
    ('remote', 'catalog.services.location_type_option.remote', 20),
    ('hybrid', 'catalog.services.location_type_option.hybrid', 30)
  ) as v(code, name_i18n_key, sort)

  union all

  -- pet gender
  select pet_gender_field.id, v.code, v.name_i18n_key, v.sort
  from pet_gender_field
  cross join (values
    ('male', 'catalog.pets.gender_option.male', 10),
    ('female', 'catalog.pets.gender_option.female', 20)
  ) as v(code, name_i18n_key, sort)

  union all

  -- baby product category
  select baby_product_category_field.id, v.code, v.name_i18n_key, v.sort
  from baby_product_category_field
  cross join (values
    ('toys', 'catalog.baby.product_category_option.toys', 10),
    ('strollers', 'catalog.baby.product_category_option.strollers', 20),
    ('car_seats', 'catalog.baby.product_category_option.car_seats', 30),
    ('feeding', 'catalog.baby.product_category_option.feeding', 40),
    ('nursery', 'catalog.baby.product_category_option.nursery', 50),
    ('care', 'catalog.baby.product_category_option.care', 60),
    ('safety', 'catalog.baby.product_category_option.safety', 70),
    ('other', 'catalog.baby.product_category_option.other', 90)
  ) as v(code, name_i18n_key, sort)

  union all

  -- baby age group
  select baby_age_group_field.id, v.code, v.name_i18n_key, v.sort
  from baby_age_group_field
  cross join (values
    ('0_6_months', 'catalog.baby.age_group_option.0_6_months', 10),
    ('6_12_months', 'catalog.baby.age_group_option.6_12_months', 20),
    ('1_3_years', 'catalog.baby.age_group_option.1_3_years', 30),
    ('3_5_years', 'catalog.baby.age_group_option.3_5_years', 40),
    ('5_plus', 'catalog.baby.age_group_option.5_plus', 50)
  ) as v(code, name_i18n_key, sort)

  union all

  -- baby condition
  select baby_condition_field.id, v.code, v.name_i18n_key, v.sort
  from baby_condition_field
  cross join (values
    ('new', 'catalog.common.condition.new', 10),
    ('excellent', 'catalog.common.condition.excellent', 20),
    ('good', 'catalog.common.condition.good', 30),
    ('used', 'catalog.common.condition.used', 40)
  ) as v(code, name_i18n_key, sort)

  union all

  -- giveaway condition
  select giveaway_condition_field.id, v.code, v.name_i18n_key, v.sort
  from giveaway_condition_field
  cross join (values
    ('new', 'catalog.common.condition.new', 10),
    ('usable', 'catalog.common.condition.usable', 20),
    ('for_parts', 'catalog.common.condition.for_parts', 30)
  ) as v(code, name_i18n_key, sort)
) as payload(field_id, code, name_i18n_key, sort)
on conflict (field_id, code) do update
set
  name_i18n_key = excluded.name_i18n_key,
  sort = excluded.sort,
  metadata = '{}'::jsonb,
  updated_at = now();

-- 3. Subcategory schemas ----------------------------------------------------
with
  furniture_cat as (select id from public.categories where slug = 'dlya-doma-i-dachi'),
  auto_parts_cat as (select id from public.categories where slug = 'zapchasti-i-aksessuary'),
  services_cat as (select id from public.categories where slug = 'uslugi'),
  pets_cat as (select id from public.categories where slug = 'domashnie-pitomcy'),
  baby_cat as (select id from public.categories where slug = 'detskie-tovary'),
  giveaway_cat as (select id from public.categories where slug = 'otdam-darom')

-- Furniture schema
insert into public.catalog_subcategory_schema (category_id, version, is_active, steps)
select furniture_cat.id, 1, true,
  jsonb_build_array(
    jsonb_build_object(
      'key', 'details',
      'title_i18n_key', 'catalog.furniture.step.details',
      'groups', jsonb_build_array(
        jsonb_build_object(
          'key', 'basic',
          'title_i18n_key', 'catalog.furniture.group.basic',
          'fields', jsonb_build_array(
            jsonb_build_object('field_key', 'furniture_material'),
            jsonb_build_object('field_key', 'furniture_condition_grade'),
            jsonb_build_object('field_key', 'furniture_style', 'optional', true)
          )
        ),
        jsonb_build_object(
          'key', 'dimensions',
          'title_i18n_key', 'catalog.furniture.group.dimensions',
          'fields', jsonb_build_array(
            jsonb_build_object('field_key', 'furniture_length_cm', 'optional', true),
            jsonb_build_object('field_key', 'furniture_width_cm', 'optional', true),
            jsonb_build_object('field_key', 'furniture_height_cm', 'optional', true)
          )
        )
      )
    ),
    jsonb_build_object(
      'key', 'extras',
      'title_i18n_key', 'catalog.furniture.step.extras',
      'groups', jsonb_build_array(
        jsonb_build_object(
          'key', 'extra',
          'title_i18n_key', 'catalog.furniture.group.extra',
          'fields', jsonb_build_array(
            jsonb_build_object('field_key', 'furniture_brand', 'optional', true),
            jsonb_build_object('field_key', 'furniture_color', 'optional', true)
          )
        )
      )
    )
  )
from furniture_cat
on conflict (category_id, version) do update
set steps = excluded.steps,
    is_active = excluded.is_active,
    updated_at = now();

-- Auto parts schema
insert into public.catalog_subcategory_schema (category_id, version, is_active, steps)
select auto_parts_cat.id, 1, true,
  jsonb_build_array(
    jsonb_build_object(
      'key', 'details',
      'title_i18n_key', 'catalog.auto_parts.step.details',
      'groups', jsonb_build_array(
        jsonb_build_object(
          'key', 'core',
          'title_i18n_key', 'catalog.auto_parts.group.core',
          'fields', jsonb_build_array(
            jsonb_build_object('field_key', 'auto_part_type'),
            jsonb_build_object('field_key', 'auto_part_condition_grade'),
            jsonb_build_object('field_key', 'auto_part_season', 'optional', true)
          )
        ),
        jsonb_build_object(
          'key', 'spec',
          'title_i18n_key', 'catalog.auto_parts.group.spec',
          'fields', jsonb_build_array(
            jsonb_build_object('field_key', 'auto_part_diameter_inch', 'optional', true),
            jsonb_build_object('field_key', 'auto_part_width_mm', 'optional', true),
            jsonb_build_object('field_key', 'auto_part_bolt_pattern', 'optional', true)
          )
        )
      )
    )
  )
from auto_parts_cat
on conflict (category_id, version) do update
set steps = excluded.steps,
    is_active = excluded.is_active,
    updated_at = now();

-- Services schema
insert into public.catalog_subcategory_schema (category_id, version, is_active, steps)
select services_cat.id, 1, true,
  jsonb_build_array(
    jsonb_build_object(
      'key', 'details',
      'title_i18n_key', 'catalog.services.step.details',
      'groups', jsonb_build_array(
        jsonb_build_object(
          'key', 'scope',
          'title_i18n_key', 'catalog.services.group.scope',
          'fields', jsonb_build_array(
            jsonb_build_object('field_key', 'service_scope'),
            jsonb_build_object('field_key', 'service_location_type'),
            jsonb_build_object('field_key', 'service_area', 'optional', true)
          )
        ),
        jsonb_build_object(
          'key', 'experience',
          'title_i18n_key', 'catalog.services.group.experience',
          'fields', jsonb_build_array(
            jsonb_build_object('field_key', 'service_experience_years', 'optional', true),
            jsonb_build_object('field_key', 'service_license', 'optional', true),
            jsonb_build_object('field_key', 'service_available_from', 'optional', true)
          )
        )
      )
    ),
    jsonb_build_object(
      'key', 'pricing',
      'title_i18n_key', 'catalog.services.step.pricing',
      'groups', jsonb_build_array(
        jsonb_build_object(
          'key', 'pricing',
          'title_i18n_key', 'catalog.services.group.pricing',
          'fields', jsonb_build_array(
            jsonb_build_object('field_key', 'service_rate_type'),
            jsonb_build_object('field_key', 'service_rate_amount', 'optional', true)
          )
        )
      )
    )
  )
from services_cat
on conflict (category_id, version) do update
set steps = excluded.steps,
    is_active = excluded.is_active,
    updated_at = now();

-- Pets schema
insert into public.catalog_subcategory_schema (category_id, version, is_active, steps)
select pets_cat.id, 1, true,
  jsonb_build_array(
    jsonb_build_object(
      'key', 'details',
      'title_i18n_key', 'catalog.pets.step.details',
      'groups', jsonb_build_array(
        jsonb_build_object(
          'key', 'basic',
          'title_i18n_key', 'catalog.pets.group.basic',
          'fields', jsonb_build_array(
            jsonb_build_object('field_key', 'pet_breed', 'optional', true),
            jsonb_build_object('field_key', 'pet_gender', 'optional', true),
            jsonb_build_object('field_key', 'pet_age_months', 'optional', true),
            jsonb_build_object('field_key', 'pet_weight_kg', 'optional', true)
          )
        ),
        jsonb_build_object(
          'key', 'health',
          'title_i18n_key', 'catalog.pets.group.health',
          'fields', jsonb_build_array(
            jsonb_build_object('field_key', 'pet_vaccinated', 'optional', true),
            jsonb_build_object('field_key', 'pet_sterilized', 'optional', true),
            jsonb_build_object('field_key', 'pet_microchip', 'optional', true),
            jsonb_build_object('field_key', 'pet_pedigree', 'optional', true)
          )
        )
      )
    ),
    jsonb_build_object(
      'key', 'extra',
      'title_i18n_key', 'catalog.pets.step.extra',
      'groups', jsonb_build_array(
        jsonb_build_object(
          'key', 'character',
          'title_i18n_key', 'catalog.pets.group.character',
          'fields', jsonb_build_array(
            jsonb_build_object('field_key', 'pet_character', 'optional', true)
          )
        )
      )
    )
  )
from pets_cat
on conflict (category_id, version) do update
set steps = excluded.steps,
    is_active = excluded.is_active,
    updated_at = now();

-- Baby & kids schema
insert into public.catalog_subcategory_schema (category_id, version, is_active, steps)
select baby_cat.id, 1, true,
  jsonb_build_array(
    jsonb_build_object(
      'key', 'details',
      'title_i18n_key', 'catalog.baby.step.details',
      'groups', jsonb_build_array(
        jsonb_build_object(
          'key', 'product',
          'title_i18n_key', 'catalog.baby.group.product',
          'fields', jsonb_build_array(
            jsonb_build_object('field_key', 'baby_product_category'),
            jsonb_build_object('field_key', 'baby_age_group'),
            jsonb_build_object('field_key', 'baby_condition_grade')
          )
        ),
        jsonb_build_object(
          'key', 'details',
          'title_i18n_key', 'catalog.baby.group.details',
          'fields', jsonb_build_array(
            jsonb_build_object('field_key', 'baby_brand', 'optional', true),
            jsonb_build_object('field_key', 'baby_color', 'optional', true),
            jsonb_build_object('field_key', 'baby_material', 'optional', true),
            jsonb_build_object('field_key', 'baby_quantity', 'optional', true)
          )
        )
      )
    ),
    jsonb_build_object(
      'key', 'safety',
      'title_i18n_key', 'catalog.baby.step.safety',
      'groups', jsonb_build_array(
        jsonb_build_object(
          'key', 'safety',
          'title_i18n_key', 'catalog.baby.group.safety',
          'fields', jsonb_build_array(
            jsonb_build_object('field_key', 'baby_safety_certified', 'optional', true),
            jsonb_build_object('field_key', 'baby_expiration_date', 'optional', true)
          )
        )
      )
    )
  )
from baby_cat
on conflict (category_id, version) do update
set steps = excluded.steps,
    is_active = excluded.is_active,
    updated_at = now();

-- Giveaway schema
insert into public.catalog_subcategory_schema (category_id, version, is_active, steps)
select giveaway_cat.id, 1, true,
  jsonb_build_array(
    jsonb_build_object(
      'key', 'details',
      'title_i18n_key', 'catalog.giveaway.step.details',
      'groups', jsonb_build_array(
        jsonb_build_object(
          'key', 'core',
          'title_i18n_key', 'catalog.giveaway.group.core',
          'fields', jsonb_build_array(
            jsonb_build_object('field_key', 'giveaway_condition_grade'),
            jsonb_build_object('field_key', 'giveaway_reason', 'optional', true),
            jsonb_build_object('field_key', 'giveaway_pickup')
          )
        ),
        jsonb_build_object(
          'key', 'timing',
          'title_i18n_key', 'catalog.giveaway.group.timing',
          'fields', jsonb_build_array(
            jsonb_build_object('field_key', 'giveaway_available_until', 'optional', true),
            jsonb_build_object('field_key', 'giveaway_requirements', 'optional', true)
          )
        )
      )
    )
  )
from giveaway_cat
on conflict (category_id, version) do update
set steps = excluded.steps,
    is_active = excluded.is_active,
    updated_at = now();

