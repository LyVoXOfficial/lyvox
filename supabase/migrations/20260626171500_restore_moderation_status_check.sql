-- Restore adverts_moderation_status_check, inadvertently dropped by the over-broad
-- DO block in 20260626171000 (now hardened). Idempotent: no-op if already present.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'adverts_moderation_status_check'
      and conrelid = 'public.adverts'::regclass
  ) then
    alter table public.adverts
      add constraint adverts_moderation_status_check
      check (moderation_status in ('pending','pending_review','approved','rejected','flagged'));
  end if;
end $$;
