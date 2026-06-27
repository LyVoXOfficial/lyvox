-- F10: Add itsme_sub to profiles for itsme OIDC uniqueness enforcement.
--
-- The UNIQUE constraint is the DB-level hard guarantee: one itsme sub = one account.
-- A collision (23505 on profiles_itsme_sub_key) means someone tried to link an itsme
-- identity that already belongs to another account — the callback must sign out and reject.
--
-- Write access: this column is NOT in the authenticated UPDATE grant from
-- 20260627220000_lock_profiles_columns.sql, so only service-role can write it.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS itsme_sub text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_itsme_sub_key'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_itsme_sub_key UNIQUE (itsme_sub);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_profiles_itsme_sub
  ON public.profiles (itsme_sub)
  WHERE itsme_sub IS NOT NULL;

COMMENT ON COLUMN public.profiles.itsme_sub IS
  'F10: OIDC subject identifier from itsme (stable per human identity). '
  'UNIQUE constraint enforces one-person-one-account. Populated by auth/callback '
  'on itsme login via service-role. NULL for users who have not used itsme.';
