-- Resolve historical CREATE TABLE IF NOT EXISTS shadowing so clean replay and
-- established projects expose one explicit production contract.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
declare
  missing_relations text;
  missing_columns text;
  invalid_rows bigint;
  invalid_types text;
begin
  select pg_catalog.string_agg(required.name, ', ' order by required.name)
  into missing_relations
  from pg_catalog.unnest(
    array[
      'vehicle_makes',
      'vehicle_models',
      'vehicle_generations',
      'vehicle_insights',
      'trust_score',
      'reports'
    ]::text[]
  ) as required(name)
  where pg_catalog.to_regclass(
    pg_catalog.format('public.%I', required.name)
  ) is null;

  if missing_relations is not null then
    raise exception using
      errcode = '55000',
      message = 'Core schema convergence refused an incomplete schema',
      detail = pg_catalog.format('Missing relations: %s', missing_relations);
  end if;

  select pg_catalog.string_agg(
    pg_catalog.format('%I.%I', required.table_name, required.column_name),
    ', '
    order by required.table_name, required.column_name
  )
  into missing_columns
  from (
    values
      ('vehicle_makes', 'id'),
      ('vehicle_makes', 'category_path'),
      ('vehicle_makes', 'is_active'),
      ('vehicle_models', 'id'),
      ('vehicle_models', 'make_id'),
      ('vehicle_models', 'years_available'),
      ('vehicle_models', 'body_types_available'),
      ('vehicle_models', 'fuel_types_available'),
      ('vehicle_models', 'transmission_available'),
      ('vehicle_models', 'reliability_score'),
      ('vehicle_models', 'popularity_score'),
      ('vehicle_generations', 'id'),
      ('vehicle_generations', 'model_id'),
      ('vehicle_generations', 'facelift'),
      ('vehicle_generations', 'production_countries'),
      ('vehicle_generations', 'body_types'),
      ('vehicle_generations', 'fuel_types'),
      ('vehicle_generations', 'transmission_types'),
      ('vehicle_insights', 'model_id'),
      ('vehicle_insights', 'pros'),
      ('vehicle_insights', 'cons'),
      ('vehicle_insights', 'inspection_tips'),
      ('vehicle_insights', 'notable_features'),
      ('vehicle_insights', 'engine_examples'),
      ('vehicle_insights', 'common_issues_by_engine'),
      ('vehicle_insights', 'reliability_score'),
      ('vehicle_insights', 'popularity_score'),
      ('trust_score', 'user_id'),
      ('trust_score', 'updated_at'),
      ('reports', 'reviewed_by')
  ) as required(table_name, column_name)
  where not exists (
    select 1
    from information_schema.columns as column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = required.table_name
      and column_info.column_name = required.column_name
  );

  if missing_columns is not null then
    raise exception using
      errcode = '42703',
      message = 'Core schema convergence refused missing canonical columns',
      detail = pg_catalog.format('Missing columns: %s', missing_columns);
  end if;

  select
    (select count(*) from public.vehicle_makes
      where category_path is null) +
    (select count(*) from public.vehicle_models
      where make_id is null
        or years_available is null
        or body_types_available is null
        or fuel_types_available is null
        or transmission_available is null) +
    (select count(*) from public.vehicle_generations
      where model_id is null) +
    (select count(*) from public.vehicle_insights
      where pros is null
        or cons is null
        or inspection_tips is null
        or notable_features is null
        or engine_examples is null
        or common_issues_by_engine is null) +
    (select count(*)
      from public.vehicle_models as model
      left join public.vehicle_makes as make on make.id = model.make_id
      where model.make_id is not null and make.id is null) +
    (select count(*)
      from public.vehicle_generations as generation
      left join public.vehicle_models as model on model.id = generation.model_id
      where generation.model_id is not null and model.id is null) +
    (select count(*)
      from public.vehicle_insights as insight
      left join public.vehicle_models as model on model.id = insight.model_id
      where model.id is null) +
    (select count(*) from (
      select model.make_id, model.slug
      from public.vehicle_models as model
      group by model.make_id, model.slug
      having count(*) > 1
    ) as duplicate_model) +
    (select count(*) from (
      select generation.model_id, generation.code
      from public.vehicle_generations as generation
      where generation.code is not null
      group by generation.model_id, generation.code
      having count(*) > 1
    ) as duplicate_generation)
  into invalid_rows;

  if invalid_rows > 0 then
    raise exception using
      errcode = '23502',
      message = 'Core schema convergence found incompatible vehicle rows',
      detail = pg_catalog.format('Invalid rows: %s', invalid_rows),
      hint = 'Review and repair the data explicitly before retrying; this migration never invents catalog values.';
  end if;

  select pg_catalog.string_agg(
    pg_catalog.format(
      '%I.%I=%s',
      column_info.table_name,
      column_info.column_name,
      column_info.data_type
    ),
    ', '
    order by column_info.table_name, column_info.column_name
  )
  into invalid_types
  from information_schema.columns as column_info
  where column_info.table_schema = 'public'
    and (
      (
        column_info.table_name = 'vehicle_makes'
        and (
          (column_info.column_name = 'id' and column_info.data_type <> 'uuid')
          or (column_info.column_name = 'category_path' and column_info.data_type <> 'text')
          or (column_info.column_name = 'is_active' and column_info.data_type <> 'boolean')
        )
      )
      or (
        column_info.table_name = 'vehicle_models'
        and (
          (column_info.column_name in ('id', 'make_id') and column_info.data_type <> 'uuid')
          or (
            column_info.column_name = 'years_available'
            and (
              column_info.data_type <> 'ARRAY'
              or column_info.udt_name <> '_int4'
            )
          )
        )
      )
      or (
        column_info.table_name = 'vehicle_generations'
        and (
          (column_info.column_name in ('id', 'model_id') and column_info.data_type <> 'uuid')
          or (column_info.column_name = 'facelift' and column_info.data_type <> 'boolean')
          or (
            column_info.column_name = 'production_countries'
            and (
              column_info.data_type <> 'ARRAY'
              or column_info.udt_name <> '_text'
            )
          )
        )
      )
      or (
        column_info.table_name = 'vehicle_insights'
        and column_info.column_name = 'model_id'
        and column_info.data_type <> 'uuid'
      )
      or (
        column_info.table_name = 'trust_score'
        and (
          (column_info.column_name = 'user_id' and column_info.data_type <> 'uuid')
          or (
            column_info.column_name = 'updated_at'
            and column_info.data_type <> 'timestamp with time zone'
          )
        )
      )
      or (
        column_info.table_name = 'reports'
        and column_info.column_name = 'reviewed_by'
        and column_info.data_type <> 'uuid'
      )
      or (
        column_info.table_name in (
          'vehicle_makes',
          'vehicle_models',
          'vehicle_generations',
          'vehicle_insights',
          'trust_score'
        )
        and column_info.column_name = 'created_at'
        and column_info.data_type <> 'timestamp with time zone'
      )
      or (
        column_info.table_name = 'vehicle_models'
        and column_info.column_name in (
          'body_types_available',
          'fuel_types_available',
          'transmission_available'
        )
        and column_info.data_type <> 'jsonb'
      )
      or (
        column_info.table_name = 'vehicle_generations'
        and column_info.column_name in (
          'body_types',
          'fuel_types',
          'transmission_types'
        )
        and column_info.data_type <> 'jsonb'
      )
      or (
        column_info.table_name = 'vehicle_insights'
        and column_info.column_name in (
          'pros',
          'cons',
          'inspection_tips',
          'notable_features',
          'engine_examples',
          'common_issues_by_engine'
        )
        and column_info.data_type <> 'jsonb'
      )
      or (
        column_info.table_name in ('vehicle_models', 'vehicle_insights')
        and column_info.column_name in (
          'reliability_score',
          'popularity_score'
        )
        and column_info.data_type not in (
          'smallint',
          'integer',
          'bigint',
          'numeric'
        )
      )
    );

  if invalid_types is not null then
    raise exception using
      errcode = '42804',
      message = 'Core schema convergence found incompatible vehicle column types',
      detail = invalid_types;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.vehicle_makes'::regclass
      and contype = 'p'
      and pg_catalog.pg_get_constraintdef(oid, true) = 'PRIMARY KEY (id)'
  ) or not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.vehicle_models'::regclass
      and contype = 'p'
      and pg_catalog.pg_get_constraintdef(oid, true) = 'PRIMARY KEY (id)'
  ) or not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.vehicle_generations'::regclass
      and contype = 'p'
      and pg_catalog.pg_get_constraintdef(oid, true) = 'PRIMARY KEY (id)'
  ) or not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.vehicle_insights'::regclass
      and contype = 'p'
      and pg_catalog.pg_get_constraintdef(oid, true) = 'PRIMARY KEY (model_id)'
  ) then
    raise exception using
      errcode = '55000',
      message = 'Canonical vehicle primary-key contract is missing';
  end if;

  if exists (
    select 1
    from public.reports as report
    left join auth.users as reviewer on reviewer.id = report.reviewed_by
    where report.reviewed_by is not null
      and reviewer.id is null
  ) then
    raise exception using
      errcode = '23503',
      message = 'reports.reviewed_by contains orphaned auth user references',
      hint = 'Resolve the orphaned reviewer IDs explicitly before adding the FK.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_record
    where trigger_record.tgrelid = 'public.trust_score'::regclass
      and trigger_record.tgname = 'set_updated_at_trust_score'
      and not trigger_record.tgisinternal
      and trigger_record.tgenabled = 'O'
  ) then
    raise exception using
      errcode = '55000',
      message = 'Canonical trust_score updated_at trigger is missing or not enabled';
  end if;
end
$$;

alter table public.vehicle_makes
  add column if not exists created_at timestamptz;
update public.vehicle_makes
set created_at = pg_catalog.transaction_timestamp()
where created_at is null;
alter table public.vehicle_makes
  alter column id set default pg_catalog.gen_random_uuid(),
  alter column category_path set default 'transport/legkovye-avtomobili',
  alter column category_path set not null,
  alter column is_active set default true,
  alter column created_at set default pg_catalog.now(),
  alter column created_at set not null;

alter table public.vehicle_models
  add column if not exists created_at timestamptz;
update public.vehicle_models
set created_at = pg_catalog.transaction_timestamp()
where created_at is null;
alter table public.vehicle_models
  alter column id set default pg_catalog.gen_random_uuid(),
  alter column make_id set not null,
  alter column years_available set default '{}'::integer[],
  alter column years_available set not null,
  alter column body_types_available set default '[]'::jsonb,
  alter column body_types_available set not null,
  alter column fuel_types_available set default '[]'::jsonb,
  alter column fuel_types_available set not null,
  alter column transmission_available set default '[]'::jsonb,
  alter column transmission_available set not null,
  alter column reliability_score type numeric
    using reliability_score::numeric,
  alter column popularity_score type numeric
    using popularity_score::numeric,
  alter column created_at set default pg_catalog.now(),
  alter column created_at set not null;

alter table public.vehicle_generations
  add column if not exists created_at timestamptz;
update public.vehicle_generations
set created_at = pg_catalog.transaction_timestamp()
where created_at is null;
alter table public.vehicle_generations
  alter column id set default pg_catalog.gen_random_uuid(),
  alter column model_id set not null,
  alter column facelift set default false,
  alter column production_countries set default '{}'::text[],
  alter column body_types set default '[]'::jsonb,
  alter column fuel_types set default '[]'::jsonb,
  alter column transmission_types set default '[]'::jsonb,
  alter column created_at set default pg_catalog.now(),
  alter column created_at set not null;

alter table public.vehicle_insights
  add column if not exists created_at timestamptz;
update public.vehicle_insights
set created_at = pg_catalog.transaction_timestamp()
where created_at is null;
alter table public.vehicle_insights
  alter column pros set default '[]'::jsonb,
  alter column pros set not null,
  alter column cons set default '[]'::jsonb,
  alter column cons set not null,
  alter column inspection_tips set default '[]'::jsonb,
  alter column inspection_tips set not null,
  alter column notable_features set default '[]'::jsonb,
  alter column notable_features set not null,
  alter column engine_examples set default '[]'::jsonb,
  alter column engine_examples set not null,
  alter column common_issues_by_engine set default '{}'::jsonb,
  alter column common_issues_by_engine set not null,
  alter column reliability_score type numeric
    using reliability_score::numeric,
  alter column popularity_score type numeric
    using popularity_score::numeric,
  alter column created_at set default pg_catalog.now(),
  alter column created_at set not null;

do $$
declare
  constraint_definition text;
begin
  select pg_catalog.pg_get_constraintdef(oid, true)
  into constraint_definition
  from pg_catalog.pg_constraint
  where conrelid = 'public.vehicle_models'::regclass
    and conname = 'vehicle_models_make_id_fkey';
  if constraint_definition is null then
    execute $sql$
      alter table public.vehicle_models
      add constraint vehicle_models_make_id_fkey
      foreign key (make_id)
      references public.vehicle_makes(id)
      on delete cascade
      not valid
    $sql$;
  elsif constraint_definition <>
    'FOREIGN KEY (make_id) REFERENCES vehicle_makes(id) ON DELETE CASCADE' then
    raise exception 'vehicle_models_make_id_fkey is divergent: %',
      constraint_definition;
  end if;

  select pg_catalog.pg_get_constraintdef(oid, true)
  into constraint_definition
  from pg_catalog.pg_constraint
  where conrelid = 'public.vehicle_generations'::regclass
    and conname = 'vehicle_generations_model_id_fkey';
  if constraint_definition is null then
    execute $sql$
      alter table public.vehicle_generations
      add constraint vehicle_generations_model_id_fkey
      foreign key (model_id)
      references public.vehicle_models(id)
      on delete cascade
      not valid
    $sql$;
  elsif constraint_definition <>
    'FOREIGN KEY (model_id) REFERENCES vehicle_models(id) ON DELETE CASCADE' then
    raise exception 'vehicle_generations_model_id_fkey is divergent: %',
      constraint_definition;
  end if;

  select pg_catalog.pg_get_constraintdef(oid, true)
  into constraint_definition
  from pg_catalog.pg_constraint
  where conrelid = 'public.vehicle_insights'::regclass
    and conname = 'vehicle_insights_model_id_fkey';
  if constraint_definition is null then
    execute $sql$
      alter table public.vehicle_insights
      add constraint vehicle_insights_model_id_fkey
      foreign key (model_id)
      references public.vehicle_models(id)
      on delete cascade
      not valid
    $sql$;
  elsif constraint_definition <>
    'FOREIGN KEY (model_id) REFERENCES vehicle_models(id) ON DELETE CASCADE' then
    raise exception 'vehicle_insights_model_id_fkey is divergent: %',
      constraint_definition;
  end if;

  select pg_catalog.pg_get_constraintdef(oid, true)
  into constraint_definition
  from pg_catalog.pg_constraint
  where conrelid = 'public.vehicle_models'::regclass
    and conname = 'vehicle_models_make_id_slug_key';
  if constraint_definition is null then
    alter table public.vehicle_models
      add constraint vehicle_models_make_id_slug_key
      unique (make_id, slug);
  elsif constraint_definition <> 'UNIQUE (make_id, slug)' then
    raise exception 'vehicle_models_make_id_slug_key is divergent: %',
      constraint_definition;
  end if;

  select pg_catalog.pg_get_constraintdef(oid, true)
  into constraint_definition
  from pg_catalog.pg_constraint
  where conrelid = 'public.vehicle_generations'::regclass
    and conname = 'vehicle_generations_model_id_code_key';
  if constraint_definition is null then
    alter table public.vehicle_generations
      add constraint vehicle_generations_model_id_code_key
      unique (model_id, code);
  elsif constraint_definition <> 'UNIQUE (model_id, code)' then
    raise exception 'vehicle_generations_model_id_code_key is divergent: %',
      constraint_definition;
  end if;
end
$$;

alter table public.vehicle_models
  validate constraint vehicle_models_make_id_fkey;
alter table public.vehicle_generations
  validate constraint vehicle_generations_model_id_fkey;
alter table public.vehicle_insights
  validate constraint vehicle_insights_model_id_fkey;

comment on table public.vehicle_models is
  'Canonical vehicle model contract: option lists are JSONB and score fields are numeric.';
comment on table public.vehicle_generations is
  'Canonical vehicle generation contract: option lists are JSONB to match catalog seeds and APIs.';

alter table public.trust_score
  add column if not exists created_at timestamptz;
alter table public.trust_score
  disable trigger set_updated_at_trust_score;
update public.trust_score
set created_at = coalesce(
  created_at,
  updated_at,
  pg_catalog.transaction_timestamp()
)
where created_at is null;
alter table public.trust_score
  enable trigger set_updated_at_trust_score;
alter table public.trust_score
  alter column created_at set default pg_catalog.now(),
  alter column created_at set not null;

do $$
declare
  reviewed_by_attribute smallint;
  auth_user_id_attribute smallint;
  existing_constraint record;
begin
  select attribute.attnum
  into reviewed_by_attribute
  from pg_catalog.pg_attribute as attribute
  where attribute.attrelid = 'public.reports'::regclass
    and attribute.attname = 'reviewed_by'
    and not attribute.attisdropped;

  select attribute.attnum
  into auth_user_id_attribute
  from pg_catalog.pg_attribute as attribute
  where attribute.attrelid = 'auth.users'::regclass
    and attribute.attname = 'id'
    and not attribute.attisdropped;

  select
    constraint_record.contype,
    constraint_record.confrelid,
    constraint_record.confdeltype,
    constraint_record.conkey,
    constraint_record.confkey
  into existing_constraint
  from pg_catalog.pg_constraint as constraint_record
  where constraint_record.conrelid = 'public.reports'::regclass
    and constraint_record.conname = 'reports_reviewed_by_fkey';

  if found then
    if existing_constraint.contype <> 'f'
      or existing_constraint.confrelid <> 'auth.users'::regclass
      or existing_constraint.confdeltype <> 'n'
      or existing_constraint.conkey <> array[reviewed_by_attribute]::smallint[]
      or existing_constraint.confkey <> array[auth_user_id_attribute]::smallint[] then
      raise exception using
        errcode = '55000',
        message = 'Existing reports_reviewed_by_fkey does not match the canonical contract';
    end if;
  else
    execute $sql$
      alter table public.reports
      add constraint reports_reviewed_by_fkey
      foreign key (reviewed_by)
      references auth.users(id)
      on delete set null
      not valid
    $sql$;
  end if;
end
$$;

alter table public.reports
  validate constraint reports_reviewed_by_fkey;

commit;
