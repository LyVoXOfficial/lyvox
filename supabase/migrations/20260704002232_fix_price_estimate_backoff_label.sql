-- T06 follow-up: keep insufficient-data backoff_level tied to the last
-- level that actually produced a sample, not a skipped parent level.

create or replace function public.estimate_price(
  p_category_id uuid,
  p_condition text default null
)
returns table (
  sample_size int,
  p25 numeric,
  median numeric,
  p75 numeric,
  backoff_level text
)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_category_path text;
  v_parent_path text;
  v_condition text := nullif(btrim(p_condition), '');
  v_level text;
  v_path text;
  v_filter_condition boolean;
  v_sample_size int := 0;
  v_p25 numeric;
  v_median numeric;
  v_p75 numeric;
  v_last_level text := 'category';
begin
  select c.path, parent.path
  into v_category_path, v_parent_path
  from public.categories c
  left join public.categories parent on parent.id = c.parent_id
  where c.id = p_category_id
    and c.is_active = true;

  if v_category_path is null then
    sample_size := 0;
    p25 := null;
    median := null;
    p75 := null;
    backoff_level := 'unsupported_category';
    return next;
    return;
  end if;

  for v_level, v_path, v_filter_condition in
    select level_name, path_prefix, condition_scoped
    from (
      values
        ('category_condition'::text, v_category_path, v_condition is not null),
        ('category'::text, v_category_path, false),
        ('parent_category'::text, v_parent_path, false)
    ) as levels(level_name, path_prefix, condition_scoped)
  loop
    continue when v_path is null;
    continue when v_level = 'category_condition' and not v_filter_condition;

    select
      count(*)::int,
      (percentile_cont(0.25) within group (order by scoped.price_value))::numeric,
      (percentile_cont(0.5) within group (order by scoped.price_value))::numeric,
      (percentile_cont(0.75) within group (order by scoped.price_value))::numeric
    into v_sample_size, v_p25, v_median, v_p75
    from (
      select a.price::numeric as price_value
      from public.adverts a
      join public.categories c on c.id = a.category_id
      left join public.profiles p on p.id = a.user_id
      where (c.path = v_path or c.path like v_path || '/%')
        and a.status = 'active'
        and coalesce(a.moderation_status, 'approved') not in ('rejected', 'flagged')
        and a.price is not null
        and a.price > 0
        and (not v_filter_condition or a.condition = v_condition)
        and (p.id is null or p.blocked_until is null or p.blocked_until <= now())
        -- TODO launch-gate: exclude seed/demo accounts once a durable seed flag exists.
    ) scoped;

    v_last_level := v_level;

    if v_sample_size >= 8 then
      sample_size := v_sample_size;
      p25 := v_p25;
      median := v_median;
      p75 := v_p75;
      backoff_level := v_level;
      return next;
      return;
    end if;
  end loop;

  sample_size := coalesce(v_sample_size, 0);
  p25 := null;
  median := null;
  p75 := null;
  backoff_level := v_last_level;
  return next;
end;
$$;

comment on function public.estimate_price(uuid, text) is
  'Internal service-role-only median/IQR price estimator with category/parent backoff. Returns null quantiles below n=8.';

revoke execute on function public.estimate_price(uuid, text) from public, anon, authenticated;
grant execute on function public.estimate_price(uuid, text) to service_role;
