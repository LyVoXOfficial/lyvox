-- Static smoke for the production control-plane and replay compatibility.
-- Run with: supabase db query --local --file supabase/tests/production_control_plane_smoke.sql

do $$
declare
  role_name text;
  relation_name text;
  function_name text;
  benefits_index_definition text;
  blocked_index_definition text;
begin
  if to_regprocedure(
    'public.set_platform_setting(text,jsonb,text,bigint,text)'
  ) is null then
    raise exception 'set_platform_setting RPC is missing';
  end if;

  if to_regprocedure(
    'public.activate_platform_emergency_stop(text,text,text)'
  ) is null then
    raise exception 'activate_platform_emergency_stop RPC is missing';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.set_platform_setting(text,jsonb,text,bigint,text)',
    'EXECUTE'
  ) then
    raise exception 'authenticated cannot execute set_platform_setting';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.activate_platform_emergency_stop(text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'authenticated cannot execute emergency stop';
  end if;

  foreach role_name in array array['anon', 'service_role'] loop
    if has_function_privilege(
      role_name,
      'public.set_platform_setting(text,jsonb,text,bigint,text)',
      'EXECUTE'
    ) then
      raise exception '% can execute set_platform_setting', role_name;
    end if;

    if has_function_privilege(
      role_name,
      'public.activate_platform_emergency_stop(text,text,text)',
      'EXECUTE'
    ) then
      raise exception '% can execute emergency stop', role_name;
    end if;
  end loop;

  foreach role_name in array array['anon', 'authenticated'] loop
    foreach relation_name in array array[
      'public.purchases',
      'public.benefits',
      'public.profiles',
      'public.platform_settings',
      'public.settings_audit'
    ] loop
      if has_table_privilege(role_name, relation_name, 'INSERT')
        or has_table_privilege(role_name, relation_name, 'DELETE')
        or has_table_privilege(role_name, relation_name, 'TRUNCATE') then
        raise exception '% retains high-risk DML on %', role_name, relation_name;
      end if;
    end loop;
  end loop;

  if exists (
    select 1
    from pg_catalog.pg_default_acl as default_acl
    join pg_catalog.pg_roles as owner_role
      on owner_role.oid = default_acl.defaclrole
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = default_acl.defaclnamespace
    cross join lateral pg_catalog.aclexplode(default_acl.defaclacl) as privilege
    join pg_catalog.pg_roles as grantee_role
      on grantee_role.oid = privilege.grantee
    where owner_role.rolname = 'postgres'
      and namespace.nspname = 'public'
      and default_acl.defaclobjtype = 'r'
      and grantee_role.rolname in ('anon', 'authenticated')
      and privilege.privilege_type = 'TRUNCATE'
  ) then
    raise exception 'browser-role TRUNCATE remains in public table default ACL';
  end if;

  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (
      select 1
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relkind in ('r', 'p')
        and has_table_privilege(
          role_name,
          pg_catalog.format('%I.%I', namespace.nspname, relation.relname),
          'TRUNCATE'
        )
    ) then
      raise exception '% retains TRUNCATE on a public table', role_name;
    end if;
  end loop;

  foreach function_name in array array[
    'public.is_user_blocked(uuid)',
    'public.user_has_flag(uuid,text)',
    'public.refresh_category_advert_counts()',
    'public.refresh_top_sellers()',
    'public.update_conversation_last_message_at()'
  ] loop
    foreach role_name in array array['anon', 'authenticated'] loop
      if has_function_privilege(role_name, function_name, 'EXECUTE') then
        raise exception '% can execute privileged helper %',
          role_name,
          function_name;
      end if;
    end loop;

    if not exists (
      select 1
      from pg_catalog.pg_proc as procedure
      where procedure.oid = function_name::regprocedure
        and coalesce(
          pg_catalog.array_to_string(procedure.proconfig, ','),
          ''
        ) like '%search_path=%'
    ) then
      raise exception '% has no fixed search_path', function_name;
    end if;
  end loop;

  foreach function_name in array array[
    'public.is_user_blocked(uuid)',
    'public.user_has_flag(uuid,text)',
    'public.refresh_category_advert_counts()',
    'public.refresh_top_sellers()'
  ] loop
    if not has_function_privilege('service_role', function_name, 'EXECUTE') then
      raise exception 'service_role cannot execute %', function_name;
    end if;
  end loop;

  if has_function_privilege(
    'service_role',
    'public.update_conversation_last_message_at()',
    'EXECUTE'
  ) then
    raise exception 'trigger helper remains directly executable by service_role';
  end if;

  if (
    select procedure.provolatile
    from pg_catalog.pg_proc as procedure
    where procedure.oid = 'public.is_user_blocked(uuid)'::regprocedure
  ) <> 's' or (
    select procedure.provolatile
    from pg_catalog.pg_proc as procedure
    where procedure.oid = 'public.user_has_flag(uuid,text)'::regprocedure
  ) <> 's' then
    raise exception 'account flag helpers are not STABLE/read-only';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prosecdef
      and (
        procedure.proconfig is null
        or coalesce(
          pg_catalog.array_to_string(procedure.proconfig, ','),
          ''
        ) not like '%search_path=%'
      )
  ) then
    raise exception 'a public SECURITY DEFINER function has no fixed search_path';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prosecdef
      and (
        has_function_privilege('anon', procedure.oid, 'EXECUTE')
        or has_function_privilege(
          'authenticated',
          procedure.oid,
          'EXECUTE'
        )
      )
      and procedure.oid not in (
        'public.is_admin()'::regprocedure,
        'public.is_business_member(uuid,text)'::regprocedure,
        'public.is_conversation_participant(uuid)'::regprocedure,
        'public.create_business(text,text,text)'::regprocedure,
        'public.create_review(uuid,integer,text)'::regprocedure,
        'public.start_conversation(uuid,uuid)'::regprocedure,
        'public.set_platform_setting(text,jsonb,text,bigint,text)'::regprocedure,
        'public.activate_platform_emergency_stop(text,text,text)'::regprocedure
      )
  ) then
    raise exception 'unexpected browser-executable SECURITY DEFINER function';
  end if;

  foreach relation_name in array array[
    'public.platform_settings',
    'public.settings_audit'
  ] loop
    if has_table_privilege('service_role', relation_name, 'INSERT')
      or has_table_privilege('service_role', relation_name, 'UPDATE')
      or has_table_privilege('service_role', relation_name, 'DELETE')
      or has_table_privilege('service_role', relation_name, 'TRUNCATE') then
      raise exception 'service_role retains mutation privileges on %', relation_name;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_class
    where oid = 'public.platform_settings'::regclass
      and relrowsecurity
  ) or not exists (
    select 1
    from pg_class
    where oid = 'public.settings_audit'::regclass
      and relrowsecurity
  ) or not exists (
    select 1
    from pg_class
    where oid = 'public.integration_health'::regclass
      and relrowsecurity
  ) then
    raise exception 'control-plane RLS is not enabled';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.settings_audit'::regclass
      and tgname = 'settings_audit_reject_row_mutation'
      and not tgisinternal
  ) or not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.settings_audit'::regclass
      and tgname = 'settings_audit_reject_truncate'
      and not tgisinternal
  ) then
    raise exception 'settings audit immutability triggers are missing';
  end if;

  if not exists (
    select 1
    from public.platform_settings
    where key = 'platform.launch_mode'
      and value ->> 'mode' = 'contact_only'
  ) or not exists (
    select 1
    from public.platform_settings
    where key = 'platform.money_emergency_stop'
      and value -> 'stopped' = 'true'::jsonb
  ) or not exists (
    select 1
    from public.platform_settings
    where key = 'platform.stripe_reconciliation'
      and value -> 'enabled' = 'false'::jsonb
  ) then
    raise exception 'fail-closed launch defaults are missing';
  end if;

  select pg_get_indexdef('public.idx_benefits_type_valid'::regclass)
  into benefits_index_definition;
  if benefits_index_definition ~* '\mwhere\M'
    or benefits_index_definition ~* '\mnow\s*\(' then
    raise exception 'benefits validity index is time-dependent: %',
      benefits_index_definition;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_index as index_state
    join pg_catalog.pg_class as index_relation
      on index_relation.oid = index_state.indexrelid
    join pg_catalog.pg_am as access_method
      on access_method.oid = index_relation.relam
    where index_state.indexrelid =
        'public.idx_benefits_type_valid'::regclass
      and index_state.indrelid = 'public.benefits'::regclass
      and index_state.indisvalid
      and index_state.indisready
      and not index_state.indisunique
      and not index_state.indisprimary
      and not index_state.indisexclusion
      and index_state.indnkeyatts = 2
      and index_state.indnatts = index_state.indnkeyatts
      and index_state.indpred is null
      and index_state.indoption::text = '0 3'
      and pg_catalog.pg_get_indexdef(
        index_state.indexrelid,
        1,
        true
      ) = 'benefit_type'
      and pg_catalog.pg_get_indexdef(
        index_state.indexrelid,
        2,
        true
      ) = 'valid_until'
      and access_method.amname = 'btree'
  ) then
    raise exception 'benefits validity index is not canonical';
  end if;

  select pg_get_indexdef('public.idx_profiles_blocked'::regclass)
  into blocked_index_definition;
  if blocked_index_definition !~* '\mwhere\M.*blocked_until is not null'
    or blocked_index_definition ~* '\mnow\s*\(' then
    raise exception 'blocked profile index is not replay-safe: %',
      blocked_index_definition;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_index as index_state
    join pg_catalog.pg_class as index_relation
      on index_relation.oid = index_state.indexrelid
    join pg_catalog.pg_am as access_method
      on access_method.oid = index_relation.relam
    where index_state.indexrelid = 'public.idx_profiles_blocked'::regclass
      and index_state.indrelid = 'public.profiles'::regclass
      and index_state.indisvalid
      and index_state.indisready
      and not index_state.indisunique
      and not index_state.indisprimary
      and not index_state.indisexclusion
      and index_state.indnkeyatts = 1
      and index_state.indnatts = index_state.indnkeyatts
      and index_state.indoption::text = '0'
      and pg_catalog.pg_get_indexdef(
        index_state.indexrelid,
        1,
        true
      ) = 'blocked_until'
      and pg_catalog.pg_get_expr(
        index_state.indpred,
        index_state.indrelid
      ) = '(blocked_until IS NOT NULL)'
      and access_method.amname = 'btree'
  ) then
    raise exception 'blocked profile index is not canonical';
  end if;

  if to_regprocedure('public.now()') is not null
    or (
      select provolatile
      from pg_proc
      where oid = 'pg_catalog.now()'::regprocedure
    ) <> 's' then
    raise exception 'temporary now() compatibility shim leaked';
  end if;

  if to_regclass('public.auto_parts_cat') is not null
    or to_regclass('public.services_cat') is not null
    or to_regclass('public.pets_cat') is not null
    or to_regclass('public.baby_cat') is not null
    or to_regclass('public.giveaway_cat') is not null then
    raise exception 'catalog replay aliases leaked into the final schema';
  end if;

  if exists (
    select 1
    from (
      values
        ('vehicle_makes', 'created_at', 'timestamp with time zone', 'NO'),
        ('vehicle_makes', 'category_path', 'text', 'NO'),
        ('vehicle_models', 'make_id', 'uuid', 'NO'),
        ('vehicle_models', 'years_available', 'ARRAY', 'NO'),
        ('vehicle_models', 'body_types_available', 'jsonb', 'NO'),
        ('vehicle_models', 'fuel_types_available', 'jsonb', 'NO'),
        ('vehicle_models', 'transmission_available', 'jsonb', 'NO'),
        ('vehicle_models', 'reliability_score', 'numeric', 'YES'),
        ('vehicle_models', 'popularity_score', 'numeric', 'YES'),
        ('vehicle_models', 'created_at', 'timestamp with time zone', 'NO'),
        ('vehicle_generations', 'model_id', 'uuid', 'NO'),
        ('vehicle_generations', 'body_types', 'jsonb', 'YES'),
        ('vehicle_generations', 'fuel_types', 'jsonb', 'YES'),
        ('vehicle_generations', 'transmission_types', 'jsonb', 'YES'),
        ('vehicle_generations', 'created_at', 'timestamp with time zone', 'NO'),
        ('vehicle_insights', 'pros', 'jsonb', 'NO'),
        ('vehicle_insights', 'cons', 'jsonb', 'NO'),
        ('vehicle_insights', 'inspection_tips', 'jsonb', 'NO'),
        ('vehicle_insights', 'notable_features', 'jsonb', 'NO'),
        ('vehicle_insights', 'engine_examples', 'jsonb', 'NO'),
        ('vehicle_insights', 'common_issues_by_engine', 'jsonb', 'NO'),
        ('vehicle_insights', 'reliability_score', 'numeric', 'YES'),
        ('vehicle_insights', 'popularity_score', 'numeric', 'YES'),
        ('vehicle_insights', 'created_at', 'timestamp with time zone', 'NO'),
        ('trust_score', 'created_at', 'timestamp with time zone', 'NO')
    ) as expected(table_name, column_name, data_type, is_nullable)
    left join information_schema.columns as actual
      on actual.table_schema = 'public'
      and actual.table_name = expected.table_name
      and actual.column_name = expected.column_name
    where actual.column_name is null
      or actual.data_type <> expected.data_type
      or actual.is_nullable <> expected.is_nullable
  ) then
    raise exception 'canonical core column contract is not satisfied';
  end if;

  if exists (
    select 1
    from (
      values
        ('vehicle_makes', 'id', 'gen_random_uuid'),
        ('vehicle_makes', 'category_path', 'transport/legkovye-avtomobili'),
        ('vehicle_makes', 'is_active', 'true'),
        ('vehicle_makes', 'created_at', 'now()'),
        ('vehicle_models', 'id', 'gen_random_uuid'),
        ('vehicle_models', 'years_available', '{}'),
        ('vehicle_models', 'body_types_available', '[]'),
        ('vehicle_models', 'fuel_types_available', '[]'),
        ('vehicle_models', 'transmission_available', '[]'),
        ('vehicle_models', 'created_at', 'now()'),
        ('vehicle_generations', 'id', 'gen_random_uuid'),
        ('vehicle_generations', 'facelift', 'false'),
        ('vehicle_generations', 'production_countries', '{}'),
        ('vehicle_generations', 'body_types', '[]'),
        ('vehicle_generations', 'fuel_types', '[]'),
        ('vehicle_generations', 'transmission_types', '[]'),
        ('vehicle_generations', 'created_at', 'now()'),
        ('vehicle_insights', 'pros', '[]'),
        ('vehicle_insights', 'cons', '[]'),
        ('vehicle_insights', 'inspection_tips', '[]'),
        ('vehicle_insights', 'notable_features', '[]'),
        ('vehicle_insights', 'engine_examples', '[]'),
        ('vehicle_insights', 'common_issues_by_engine', '{}'),
        ('vehicle_insights', 'created_at', 'now()'),
        ('trust_score', 'created_at', 'now()')
    ) as expected(table_name, column_name, default_fragment)
    left join information_schema.columns as actual
      on actual.table_schema = 'public'
      and actual.table_name = expected.table_name
      and actual.column_name = expected.column_name
    where actual.column_default is null
      or position(
        expected.default_fragment in actual.column_default
      ) = 0
  ) then
    raise exception 'canonical core default contract is not satisfied';
  end if;

  if exists (
    select 1
    from (
      values
        ('vehicle_makes', 'vehicle_makes_pkey', 'PRIMARY KEY (id)'),
        ('vehicle_models', 'vehicle_models_pkey', 'PRIMARY KEY (id)'),
        ('vehicle_models', 'vehicle_models_make_id_fkey', 'FOREIGN KEY (make_id) REFERENCES vehicle_makes(id) ON DELETE CASCADE'),
        ('vehicle_models', 'vehicle_models_make_id_slug_key', 'UNIQUE (make_id, slug)'),
        ('vehicle_generations', 'vehicle_generations_pkey', 'PRIMARY KEY (id)'),
        ('vehicle_generations', 'vehicle_generations_model_id_fkey', 'FOREIGN KEY (model_id) REFERENCES vehicle_models(id) ON DELETE CASCADE'),
        ('vehicle_generations', 'vehicle_generations_model_id_code_key', 'UNIQUE (model_id, code)'),
        ('vehicle_insights', 'vehicle_insights_pkey', 'PRIMARY KEY (model_id)'),
        ('vehicle_insights', 'vehicle_insights_model_id_fkey', 'FOREIGN KEY (model_id) REFERENCES vehicle_models(id) ON DELETE CASCADE')
    ) as expected(table_name, constraint_name, definition)
    left join pg_catalog.pg_constraint as actual
      on actual.conrelid = pg_catalog.to_regclass(
        pg_catalog.format('public.%I', expected.table_name)
      )
      and actual.conname = expected.constraint_name
    where actual.oid is null
      or not actual.convalidated
      or pg_catalog.pg_get_constraintdef(actual.oid, true) <>
        expected.definition
  ) then
    raise exception 'canonical vehicle constraint contract is not satisfied';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_record
    join pg_catalog.pg_attribute as reviewed_attribute
      on reviewed_attribute.attrelid = constraint_record.conrelid
      and reviewed_attribute.attnum = constraint_record.conkey[1]
    join pg_catalog.pg_attribute as user_id_attribute
      on user_id_attribute.attrelid = constraint_record.confrelid
      and user_id_attribute.attnum = constraint_record.confkey[1]
    where constraint_record.conrelid = 'public.reports'::regclass
      and constraint_record.conname = 'reports_reviewed_by_fkey'
      and constraint_record.contype = 'f'
      and constraint_record.confrelid = 'auth.users'::regclass
      and constraint_record.confdeltype = 'n'
      and constraint_record.convalidated
      and pg_catalog.array_length(constraint_record.conkey, 1) = 1
      and pg_catalog.array_length(constraint_record.confkey, 1) = 1
      and reviewed_attribute.attname = 'reviewed_by'
      and user_id_attribute.attname = 'id'
  ) then
    raise exception 'reports.reviewed_by FK is missing or divergent';
  end if;

  raise notice 'production_control_plane_smoke_ok';
end
$$;
