-- Ensure primary key exists on supabase_migrations.seed_files
-- This is safe to run multiple times; it only adds the PK if missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE c.conname = 'seed_files_pkey'
      AND n.nspname = 'supabase_migrations'
      AND t.relname = 'seed_files'
  ) THEN
    EXECUTE 'ALTER TABLE IF EXISTS supabase_migrations.seed_files ADD CONSTRAINT seed_files_pkey PRIMARY KEY (path)';
  END IF;
END
$$;
