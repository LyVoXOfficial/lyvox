DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE c.contype = 'p' AND n.nspname = 'supabase_migrations' AND t.relname = 'seed_files'
  ) THEN
    ALTER TABLE supabase_migrations.seed_files ADD PRIMARY KEY (path);
  END IF;
END$$;
