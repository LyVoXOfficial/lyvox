-- DB-002: Add missing indexes for performance
-- This migration adds performance indexes for search, filtering, and category queries

-- Enable extensions for full-text search
-- pg_trgm is useful for flexible text matching (prefix, similarity search)
create extension if not exists pg_trgm;

-- 1. Full-text search index for adverts (title + description)
-- Using GIN index with tsvector for standard full-text search
-- This enables efficient full-text search queries

-- Create a generated column for tsvector (if it doesn't exist)
-- Note: We'll create a function-based index instead to avoid altering table schema
-- This allows searching across title and description together

create index if not exists adverts_title_description_gin_idx 
  on public.adverts 
  using gin(to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '')));

-- Also create a trigram index for flexible matching (prefix, similarity)
-- This is useful for "like" queries and autocomplete
create index if not exists adverts_title_trgm_idx 
  on public.adverts 
  using gin(title gin_trgm_ops);

create index if not exists adverts_description_trgm_idx 
  on public.adverts 
  using gin(description gin_trgm_ops)
  where description is not null;

-- 2. Composite index for filtering adverts
-- Optimizes queries filtering by category_id, status, and sorting by created_at
-- Common query pattern: WHERE category_id = ? AND status = ? ORDER BY created_at DESC
create index if not exists adverts_category_status_created_at_idx 
  on public.adverts(category_id, status, created_at desc);

-- 3. Composite index for categories
-- Optimizes category tree queries filtering by parent_id, is_active, and sorting by sort
-- Common query pattern: WHERE parent_id = ? AND is_active = true ORDER BY sort
create index if not exists categories_parent_active_sort_idx 
  on public.categories(parent_id, is_active, sort)
  where is_active = true;

-- Add comments for documentation
comment on index public.adverts_title_description_gin_idx is 'GIN index for full-text search across title and description';
comment on index public.adverts_title_trgm_idx is 'Trigram index for flexible title matching (prefix, similarity)';
comment on index public.adverts_description_trgm_idx is 'Trigram index for flexible description matching (prefix, similarity)';
comment on index public.adverts_category_status_created_at_idx is 'Composite index for filtering adverts by category, status, and sorting by creation date';
comment on index public.categories_parent_active_sort_idx is 'Composite partial index for active category tree queries by parent with sorting';


