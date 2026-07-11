-- Converge databases where the historical migration was already recorded.
-- A canonical existing index is left untouched; only a missing or divergent
-- definition is rebuilt. DDL is transactional, so callers never observe a
-- committed state without the replacement index.
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
    and index_state.indrelid = 'public.benefits'::regclass
    and index_state.indnkeyatts = 2
    and index_state.indnatts = index_state.indnkeyatts
    and index_state.indpred is null
    and index_state.indoption::text = '0 3'
    and pg_get_indexdef(index_state.indexrelid, 1, true) = 'benefit_type'
    and pg_get_indexdef(index_state.indexrelid, 2, true) = 'valid_until'
    and access_method.amname = 'btree'
  into is_canonical
  from pg_index index_state
  join pg_class index_relation on index_relation.oid = index_state.indexrelid
  join pg_am access_method on access_method.oid = index_relation.relam
  where index_relation.oid = to_regclass('public.idx_benefits_type_valid');

  if coalesce(is_canonical, false) then
    return;
  end if;

  execute 'create index idx_benefits_type_valid__lyvox_20260711011031 '
    || 'on public.benefits(benefit_type, valid_until desc)';
  execute 'drop index if exists public.idx_benefits_type_valid';
  execute 'alter index public.idx_benefits_type_valid__lyvox_20260711011031 '
    || 'rename to idx_benefits_type_valid';
end
$$;

commit;
