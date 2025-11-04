-- Add German language support to categories table
-- Migration: 20251102214500_add_german_to_categories.sql

BEGIN;

-- Add name_de column if it doesn't exist
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS name_de TEXT;

-- Fill with English values as fallback (will be replaced with proper translations later)
UPDATE public.categories 
SET name_de = name_en 
WHERE name_de IS NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_categories_name_de 
ON public.categories(name_de);

-- Add comment for documentation
COMMENT ON COLUMN public.categories.name_de IS 'German category name (Deutsch)';

COMMIT;

