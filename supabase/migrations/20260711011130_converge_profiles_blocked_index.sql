-- Converge databases where the historical account-flags migration was already
-- recorded. A canonical existing index is left untouched.
begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
declare
  is_canonical boolean := false;
begin
  select
    index_state.indisvalid
    and index_state.indisready
    and not index_state.indisunique
    and not index_state.indisprimary
    and not index_state.indisexclusion
    and index_state.indrelid = 'public.profiles'::regclass
    and index_state.indnkeyatts = 1
    and index_state.indnatts = index_state.indnkeyatts
    and index_state.indoption::text = '0'
    and pg_get_indexdef(index_state.indexrelid, 1, true) = 'blocked_until'
    and pg_get_expr(index_state.indpred, index_state.indrelid)
      = '(blocked_until IS NOT NULL)'
    and access_method.amname = 'btree'
  into is_canonical
  from pg_index index_state
  join pg_class index_relation on index_relation.oid = index_state.indexrelid
  join pg_am access_method on access_method.oid = index_relation.relam
  where index_relation.oid = to_regclass('public.idx_profiles_blocked');

  if coalesce(is_canonical, false) then
    return;
  end if;

  execute 'create index idx_profiles_blocked__lyvox_20260711011130 '
    || 'on public.profiles(blocked_until) '
    || 'where blocked_until is not null';
  execute 'drop index if exists public.idx_profiles_blocked';
  execute 'alter index public.idx_profiles_blocked__lyvox_20260711011130 '
    || 'rename to idx_profiles_blocked';
end
$$;

commit;
