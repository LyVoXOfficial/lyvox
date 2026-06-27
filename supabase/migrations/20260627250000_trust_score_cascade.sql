-- Erasure fix: trust_score.user_id was ON DELETE NO ACTION (the only remaining FK to auth.users that
-- would BLOCK account deletion). trust_score is the user's own derived reputation (NOT NULL + PK on user_id,
-- so SET NULL is impossible and there is no retention basis) -> CASCADE: the row is removed with the user.
-- Without this, deleteUser fails for any user that has a trust_score row (i.e. essentially all of them).

begin;
alter table public.trust_score drop constraint trust_score_user_id_fkey;
alter table public.trust_score add constraint trust_score_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
commit;
