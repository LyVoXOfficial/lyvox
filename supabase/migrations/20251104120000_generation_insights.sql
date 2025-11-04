-- Migration: Add generation-specific insights tables
-- Description: Replace model-level insights with generation-level insights for more accurate data

-- 1. Create new table vehicle_generation_insights (temporarily alongside old tables)
CREATE TABLE IF NOT EXISTS public.vehicle_generation_insights (
    generation_id UUID PRIMARY KEY REFERENCES public.vehicle_generations(id) ON DELETE CASCADE,
    pros TEXT[] DEFAULT '{}',
    cons TEXT[] DEFAULT '{}',
    inspection_tips TEXT[] DEFAULT '{}',
    notable_features TEXT[] DEFAULT '{}',
    engine_examples TEXT[] DEFAULT '{}',
    common_issues TEXT[] DEFAULT '{}',
    reliability_score INTEGER,
    popularity_score INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create translations table for generations
CREATE TABLE IF NOT EXISTS public.vehicle_generation_insights_i18n (
    generation_id UUID NOT NULL REFERENCES public.vehicle_generation_insights(generation_id) ON DELETE CASCADE,
    locale TEXT NOT NULL CHECK (locale = ANY (ARRAY['en'::TEXT, 'fr'::TEXT, 'nl'::TEXT, 'ru'::TEXT, 'de'::TEXT])),
    pros TEXT[] DEFAULT '{}',
    cons TEXT[] DEFAULT '{}',
    inspection_tips TEXT[] DEFAULT '{}',
    notable_features TEXT[] DEFAULT '{}',
    engine_examples TEXT[] DEFAULT '{}',
    common_issues TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (generation_id, locale)
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS vehicle_generation_insights_generation_id_idx
    ON public.vehicle_generation_insights(generation_id);

CREATE INDEX IF NOT EXISTS vehicle_generation_insights_i18n_generation_id_idx
    ON public.vehicle_generation_insights_i18n(generation_id);

CREATE INDEX IF NOT EXISTS vehicle_generation_insights_i18n_locale_idx
    ON public.vehicle_generation_insights_i18n(locale);

-- 4. Add RLS policies for read access
ALTER TABLE public.vehicle_generation_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_generation_insights_i18n ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicle_generation_insights_read" ON public.vehicle_generation_insights
    FOR SELECT USING (true);

CREATE POLICY "vehicle_generation_insights_i18n_read" ON public.vehicle_generation_insights_i18n
    FOR SELECT USING (true);

-- Add comment for documentation
COMMENT ON TABLE public.vehicle_generation_insights IS 'Generation-specific vehicle insights (pros, cons, tips, etc.)';
COMMENT ON TABLE public.vehicle_generation_insights_i18n IS 'Translations for generation-specific vehicle insights';

