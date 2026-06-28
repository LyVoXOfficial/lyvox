-- F7: Add generation_id FK column to adverts table.
--
-- Motivation: specifics JSONB had generation_id as a free-form string,
-- which caused bug #1996 — determineGeneration() used .find() on year-range
-- overlap, silently picking the wrong generation for e.g. 1996 BMW 5-Series
-- (E34 ends 1996, E39 starts 1996 → both match → picked at random by array order).
--
-- Fix: store a proper FK so the seller's explicit choice is persisted.
-- On ambiguous year-ranges the form shows a chooser; NULL means "not set yet".

ALTER TABLE public.adverts
  ADD COLUMN IF NOT EXISTS generation_id uuid REFERENCES public.vehicle_generations(id);

-- Backfill existing records: migrate from JSONB specifics.generation_id to the FK column.
-- Only migrates when the JSONB value is a well-formed UUID that actually exists in
-- vehicle_generations.  Records with no JSONB value or no exact match stay NULL —
-- we do not guess for ambiguous year-range cases.
UPDATE public.adverts a
SET generation_id = (s.specifics->>'generation_id')::uuid
FROM public.ad_item_specifics s
WHERE s.advert_id = a.id
  AND a.generation_id IS NULL
  AND (s.specifics->>'generation_id') IS NOT NULL
  AND (s.specifics->>'generation_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.vehicle_generations vg
    WHERE vg.id = (s.specifics->>'generation_id')::uuid
  );

CREATE INDEX IF NOT EXISTS idx_adverts_generation_id
  ON public.adverts (generation_id)
  WHERE generation_id IS NOT NULL;

COMMENT ON COLUMN public.adverts.generation_id IS
  'F7: FK to vehicle_generations. Explicit seller choice — NULL when not set or ambiguous. '
  'Replaces free-form specifics.generation_id JSON string (bug #1996 fix).';
