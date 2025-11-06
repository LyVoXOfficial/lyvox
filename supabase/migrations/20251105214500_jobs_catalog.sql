-- Migration: Jobs Catalog
-- Purpose: Create specialized tables for job listings (vacancies & resumes)
-- Date: 2025-11-05
-- Dependencies: 20251105213527_catalog_dictionaries.sql

-- =============================================================================
-- MAIN JOB LISTINGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.job_listings (
  advert_id UUID PRIMARY KEY REFERENCES public.adverts(id) ON DELETE CASCADE,
  
  -- Classification
  job_category_id UUID REFERENCES public.job_categories(id),
  cp_code TEXT REFERENCES public.cp_codes(code), -- Belgium CP code
  contract_type_id UUID REFERENCES public.job_contract_types(id),
  employment_type TEXT NOT NULL CHECK (employment_type IN ('full_time', 'part_time', 'freelance', 'internship')),
  
  -- Schedule
  hours_per_week NUMERIC CHECK (hours_per_week > 0 AND hours_per_week <= 80),
  shift_work BOOLEAN DEFAULT false,
  weekend_work BOOLEAN DEFAULT false,
  night_shifts BOOLEAN DEFAULT false,
  flexible_hours BOOLEAN DEFAULT false,
  remote_option TEXT CHECK (remote_option IN ('none', 'hybrid', 'full_remote')),
  
  -- Compensation
  salary_min NUMERIC CHECK (salary_min IS NULL OR salary_min >= 0),
  salary_max NUMERIC CHECK (salary_max IS NULL OR salary_max >= salary_min),
  salary_currency TEXT DEFAULT 'EUR' CHECK (salary_currency IN ('EUR', 'USD', 'GBP')),
  salary_period TEXT CHECK (salary_period IN ('hour', 'month', 'year')),
  salary_type TEXT CHECK (salary_type IN ('gross', 'net')),
  salary_negotiable BOOLEAN DEFAULT false,
  
  -- Benefits (stored as array)
  benefits TEXT[], -- ['meal_vouchers', 'company_car', 'insurance', 'bonus', 'pension']
  
  -- Requirements
  experience_years_min INT CHECK (experience_years_min IS NULL OR experience_years_min >= 0),
  education_level TEXT CHECK (education_level IN ('none', 'high_school', 'bachelor', 'master', 'phd')),
  languages_required TEXT[], -- ['nl', 'fr', 'en', 'de']
  languages_preferred TEXT[],
  driving_license_required BOOLEAN DEFAULT false,
  license_types TEXT[], -- ['B', 'C', 'CE', 'D']
  
  -- Legal (Belgium-specific)
  work_permit_required BOOLEAN DEFAULT false, -- For non-EU citizens
  work_permit_sponsored BOOLEAN DEFAULT false, -- Employer will sponsor
  
  -- Company Info
  company_name TEXT CHECK (LENGTH(company_name) <= 200),
  company_size TEXT CHECK (company_size IN ('startup', 'small', 'medium', 'large', 'enterprise')),
  industry TEXT CHECK (LENGTH(industry) <= 100),
  
  -- Application
  application_deadline DATE,
  start_date DATE,
  contact_email TEXT CHECK (contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  contact_phone TEXT,
  application_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT salary_range_valid CHECK (salary_max IS NULL OR salary_min IS NULL OR salary_max >= salary_min),
  CONSTRAINT deadline_future CHECK (application_deadline IS NULL OR application_deadline >= CURRENT_DATE),
  CONSTRAINT start_date_reasonable CHECK (start_date IS NULL OR start_date >= CURRENT_DATE - INTERVAL '30 days')
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Primary search indexes
CREATE INDEX job_listings_category_idx ON public.job_listings(job_category_id);
CREATE INDEX job_listings_cp_code_idx ON public.job_listings(cp_code);
CREATE INDEX job_listings_contract_type_idx ON public.job_listings(contract_type_id);
CREATE INDEX job_listings_employment_type_idx ON public.job_listings(employment_type);

-- Filter indexes
CREATE INDEX job_listings_remote_idx ON public.job_listings(remote_option);
CREATE INDEX job_listings_salary_idx ON public.job_listings(salary_min, salary_max) 
  WHERE salary_min IS NOT NULL;
CREATE INDEX job_listings_experience_idx ON public.job_listings(experience_years_min)
  WHERE experience_years_min IS NOT NULL;

-- Language requirements (GIN index for array search)
CREATE INDEX job_listings_languages_idx ON public.job_listings USING GIN (languages_required);

-- Composite search index
-- Composite search index (simplified - can't use subquery in WHERE clause)
CREATE INDEX job_listings_search_idx 
ON public.job_listings(employment_type, contract_type_id, remote_option, job_category_id);

-- Active listings deadline index (for cleanup jobs)
CREATE INDEX job_listings_deadline_idx ON public.job_listings(application_deadline)
WHERE application_deadline IS NOT NULL;

-- =============================================================================
-- VALIDATION FUNCTIONS
-- =============================================================================

-- Validate job listing data
CREATE OR REPLACE FUNCTION validate_job_listing(
  p_employment_type TEXT,
  p_hours_per_week NUMERIC,
  p_salary_min NUMERIC,
  p_salary_max NUMERIC,
  p_salary_period TEXT,
  p_work_permit_required BOOLEAN,
  p_languages_required TEXT[]
) RETURNS BOOLEAN AS $$
BEGIN
  -- Full-time should have reasonable hours
  IF p_employment_type = 'full_time' AND p_hours_per_week IS NOT NULL THEN
    IF p_hours_per_week < 35 OR p_hours_per_week > 45 THEN
      RAISE WARNING 'Full-time position with unusual hours: % per week', p_hours_per_week;
    END IF;
  END IF;
  
  -- Part-time should be < 35 hours typically
  IF p_employment_type = 'part_time' AND p_hours_per_week IS NOT NULL THEN
    IF p_hours_per_week >= 35 THEN
      RAISE WARNING 'Part-time position with full-time hours: % per week', p_hours_per_week;
    END IF;
  END IF;
  
  -- Salary sanity checks (Belgium context)
  IF p_salary_min IS NOT NULL AND p_salary_period = 'month' THEN
    -- Minimum wage in Belgium ~€1,800 gross/month
    IF p_salary_min < 1000 THEN
      RAISE WARNING 'Monthly salary (€%) below typical minimum wage', p_salary_min;
    END IF;
    -- Flag unrealistic high salaries
    IF p_salary_max IS NOT NULL AND p_salary_max > 20000 THEN
      RAISE WARNING 'Monthly salary (€%) unusually high, verify accuracy', p_salary_max;
    END IF;
  END IF;
  
  -- Belgium requires NL or FR typically
  IF p_languages_required IS NOT NULL AND array_length(p_languages_required, 1) > 0 THEN
    IF NOT ('nl' = ANY(p_languages_required)) AND NOT ('fr' = ANY(p_languages_required)) THEN
      RAISE NOTICE 'Job in Belgium without NL or FR requirement - verify if intentional';
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_job_listings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER job_listings_updated_at
BEFORE UPDATE ON public.job_listings
FOR EACH ROW
EXECUTE FUNCTION update_job_listings_updated_at();

-- Validate before insert/update
CREATE OR REPLACE FUNCTION validate_job_listing_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Run validation
  PERFORM validate_job_listing(
    NEW.employment_type,
    NEW.hours_per_week,
    NEW.salary_min,
    NEW.salary_max,
    NEW.salary_period,
    NEW.work_permit_required,
    NEW.languages_required
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER job_listings_validate
BEFORE INSERT OR UPDATE ON public.job_listings
FOR EACH ROW
EXECUTE FUNCTION validate_job_listing_trigger();

-- Auto-archive expired job listings
CREATE OR REPLACE FUNCTION archive_expired_jobs()
RETURNS void AS $$
BEGIN
  UPDATE public.adverts
  SET status = 'archived'
  WHERE id IN (
    SELECT advert_id 
    FROM public.job_listings
    WHERE application_deadline < CURRENT_DATE
    AND advert_id IN (
      SELECT id FROM public.adverts WHERE status = 'active'
    )
  );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE public.job_listings ENABLE ROW LEVEL SECURITY;

-- Users can view approved listings + their own
CREATE POLICY "users_view_job_listings"
ON public.job_listings FOR SELECT
USING (
  advert_id IN (
    SELECT id FROM public.adverts 
    WHERE auth.uid() = user_id 
    OR status = 'active'
  )
);

-- Users can insert their own job listings
CREATE POLICY "users_insert_job_listings"
ON public.job_listings FOR INSERT
WITH CHECK (
  advert_id IN (SELECT id FROM public.adverts WHERE auth.uid() = user_id)
);

-- Users can update their own draft/rejected listings
CREATE POLICY "users_update_job_listings"
ON public.job_listings FOR UPDATE
USING (
  advert_id IN (
    SELECT id FROM public.adverts 
    WHERE auth.uid() = user_id 
    AND status IN ('draft', 'rejected')
  )
);

-- Users can delete their own draft listings
CREATE POLICY "users_delete_job_listings"
ON public.job_listings FOR DELETE
USING (
  advert_id IN (
    SELECT id FROM public.adverts 
    WHERE auth.uid() = user_id 
    AND status = 'draft'
  )
);

-- =============================================================================
-- HELPER VIEWS
-- =============================================================================

-- View for public job search
CREATE OR REPLACE VIEW public.job_listings_public AS
SELECT 
  jl.advert_id,
  jl.job_category_id,
  jl.contract_type_id,
  jl.employment_type,
  jl.hours_per_week,
  jl.remote_option,
  jl.salary_min,
  jl.salary_max,
  jl.salary_currency,
  jl.salary_period,
  jl.salary_type,
  jl.benefits,
  jl.experience_years_min,
  jl.education_level,
  jl.languages_required,
  jl.driving_license_required,
  jl.work_permit_required,
  jl.work_permit_sponsored,
  jl.company_name,
  jl.company_size,
  jl.industry,
  jl.application_deadline,
  jl.start_date,
  -- Hide contact details until user shows interest
  CASE 
    WHEN jl.contact_email IS NOT NULL THEN 'HIDDEN_UNTIL_CONTACT'
    ELSE NULL
  END AS contact_email,
  jl.created_at
FROM public.job_listings jl
WHERE jl.advert_id IN (
  SELECT id FROM public.adverts 
  WHERE status = 'active'
);

-- =============================================================================
-- SCHEDULED JOBS (pg_cron or manual execution)
-- =============================================================================

-- To be scheduled: Archive expired job listings daily
-- Example cron: SELECT cron.schedule('archive-expired-jobs', '0 2 * * *', 'SELECT archive_expired_jobs();');

COMMENT ON FUNCTION archive_expired_jobs() IS 
  'Archives job listings past their application deadline. 
   Should be run daily via cron job or scheduled task.';

-- =============================================================================
-- COMMENTS (Documentation)
-- =============================================================================

COMMENT ON TABLE public.job_listings IS 
  'Specialized table for job vacancy listings in Belgium. 
   Includes Belgium-specific fields (CP codes, work permits, language requirements).
   See docs/catalog/categories/jobs.md for complete specification.';

COMMENT ON COLUMN public.job_listings.cp_code IS 
  'Belgium CP code (Paritair Comité / Commission Paritaire). 
   Joint labor committee code indicating the sector and applicable collective labor agreement.';

COMMENT ON COLUMN public.job_listings.work_permit_required IS 
  'Indicates if work permit is required for non-EU citizens. 
   Belgian employers must disclose this information.';

COMMENT ON COLUMN public.job_listings.languages_required IS 
  'Array of ISO language codes (nl, fr, en, de). 
   Critical in Belgium due to trilingual nature of the job market.';

COMMENT ON VIEW public.job_listings_public IS 
  'Public view of job listings with contact details hidden. 
   Contact information revealed after user expresses interest.';

-- =============================================================================
-- STATISTICS
-- =============================================================================

ANALYZE public.job_listings;

-- =============================================================================
-- ROLLBACK INSTRUCTIONS (commented out)
-- =============================================================================

/*
-- To rollback this migration:

DROP VIEW IF EXISTS public.job_listings_public;

DROP TRIGGER IF EXISTS job_listings_validate ON public.job_listings;
DROP TRIGGER IF EXISTS job_listings_updated_at ON public.job_listings;

DROP FUNCTION IF EXISTS validate_job_listing_trigger();
DROP FUNCTION IF EXISTS update_job_listings_updated_at();
DROP FUNCTION IF EXISTS archive_expired_jobs();
DROP FUNCTION IF EXISTS validate_job_listing(TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, BOOLEAN, TEXT[]);

DROP POLICY IF EXISTS "users_delete_job_listings" ON public.job_listings;
DROP POLICY IF EXISTS "users_update_job_listings" ON public.job_listings;
DROP POLICY IF EXISTS "users_insert_job_listings" ON public.job_listings;
DROP POLICY IF EXISTS "users_view_job_listings" ON public.job_listings;

DROP INDEX IF EXISTS job_listings_deadline_idx;
DROP INDEX IF EXISTS job_listings_search_idx;
DROP INDEX IF EXISTS job_listings_languages_idx;
DROP INDEX IF EXISTS job_listings_experience_idx;
DROP INDEX IF EXISTS job_listings_salary_idx;
DROP INDEX IF EXISTS job_listings_remote_idx;
DROP INDEX IF EXISTS job_listings_employment_type_idx;
DROP INDEX IF EXISTS job_listings_contract_type_idx;
DROP INDEX IF EXISTS job_listings_cp_code_idx;
DROP INDEX IF EXISTS job_listings_category_idx;

DROP TABLE IF EXISTS public.job_listings CASCADE;
*/

