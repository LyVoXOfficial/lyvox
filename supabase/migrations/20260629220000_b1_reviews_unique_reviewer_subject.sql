-- B1: Add UNIQUE(reviewer_id, subject_id) constraint on reviews.
--
-- Background: F14 added an application-level EXISTS guard so create_review()
-- already prevents new duplicate (reviewer_id, subject_id) pairs. This migration
-- adds the matching DB-level constraint so the guarantee is enforced regardless
-- of how the table is accessed in the future.
--
-- Safe dedup procedure (no legitimate reviews are harmed):
--   A "duplicate" is any (reviewer_id, subject_id) pair that appears more than
--   once. We keep the row with the latest created_at and delete the extras.
--   If two rows share the same created_at we keep the one with the smaller id
--   (arbitrary but deterministic tie-break). Rows with a unique (reviewer_id,
--   subject_id) pair are untouched.
--
-- Idempotent: the DO block checks whether the constraint already exists before
-- running ALTER TABLE, so re-applying the migration is safe.

do $$
declare
  v_deleted int;
begin

  -- 1. Dedup: delete extras, keeping the newest row per (reviewer_id, subject_id).
  with keepers as (
    select distinct on (reviewer_id, subject_id)
           id
    from   public.reviews
    order  by reviewer_id, subject_id, created_at desc, id asc
  ),
  removed as (
    delete from public.reviews
    where  id not in (select id from keepers)
      -- Only touch rows where a duplicate actually exists for this pair
      and  exists (
        select 1
        from   public.reviews r2
        where  r2.reviewer_id = public.reviews.reviewer_id
          and  r2.subject_id  = public.reviews.subject_id
          and  r2.id         != public.reviews.id
      )
    returning id
  )
  select count(*) into v_deleted from removed;

  raise notice 'B1 dedup: % duplicate review row(s) deleted (audit count)', v_deleted;

  -- 2. Add the unique constraint only if it does not already exist.
  if not exists (
    select 1
    from   pg_constraint
    where  conrelid = 'public.reviews'::regclass
      and  conname  = 'reviews_unique_reviewer_subject'
  ) then
    alter table public.reviews
      add constraint reviews_unique_reviewer_subject
      unique (reviewer_id, subject_id);
  end if;

end;
$$;

comment on constraint reviews_unique_reviewer_subject on public.reviews is
  'One review per reviewer–seller pair across all adverts. Enforces F14 anti-stacking at DB level. B1 hardening 2026-06-29.';
