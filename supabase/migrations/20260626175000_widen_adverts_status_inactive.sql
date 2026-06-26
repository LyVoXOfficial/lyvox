-- C1 (whole-branch review): the Phase-A0 adverts_status_check (20260626171000) omitted 'inactive',
-- which two live moderation paths write (api/reports/update, admin/reports/page) to unpublish
-- reported adverts. The omission silently broke moderator unpublish on prod. Widen to restore.
alter table public.adverts drop constraint if exists adverts_status_check;
alter table public.adverts add constraint adverts_status_check
  check (status in ('active','archived','draft','sold','withdrawn','inactive'));
