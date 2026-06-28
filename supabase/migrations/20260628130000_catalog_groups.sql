-- F13: catalog_groups — normalized display configuration for catalog field groups.
--
-- Problem: CatalogSchemaGroup embeds display config in JSONB schema, making it
-- impossible to change layout without updating every subcategory schema.
-- This table is the canonical source for how each domain+group should be rendered.
--
-- display='tab'     → ARIA tabs (vehicle, real_estate)
-- display='section' → accordion / stacked sections (fashion, home, electronics)

CREATE TABLE IF NOT EXISTS public.catalog_groups (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  domain      text        NOT NULL,
  group_key   text        NOT NULL,
  display     text        NOT NULL DEFAULT 'section'
                          CONSTRAINT catalog_groups_display_check
                          CHECK (display IN ('tab', 'section')),
  tab_key     text,
  tab_order   int         NOT NULL DEFAULT 0,
  icon        text,
  collapsed   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_groups_domain_group_key UNIQUE (domain, group_key)
);

COMMENT ON TABLE public.catalog_groups IS
  'F13: display config per domain+group_key. tab=ARIA tabs row; section=stacked block.';
COMMENT ON COLUMN public.catalog_groups.tab_key IS
  'Stable identifier for the tab (used as value in Radix Tabs). NULL for section display.';

CREATE INDEX IF NOT EXISTS catalog_groups_domain_idx ON public.catalog_groups (domain);

-- RLS: public read; no policies = service-role write only
ALTER TABLE public.catalog_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog_groups_public_read" ON public.catalog_groups
  FOR SELECT USING (true);

-- ── Seed data ────────────────────────────────────────────────────────────────
-- Vehicle → tabs (main UX pattern for PRD 62)
INSERT INTO public.catalog_groups (domain, group_key, display, tab_key, tab_order) VALUES
  ('vehicle', 'overview',  'tab', 'overview',  0),
  ('vehicle', 'engine',    'tab', 'engine',    1),
  ('vehicle', 'body',      'tab', 'body',      2),
  ('vehicle', 'comfort',   'tab', 'comfort',   3),
  ('vehicle', 'history',   'tab', 'history',   4),
  ('vehicle', 'safety',    'tab', 'safety',    5)
ON CONFLICT (domain, group_key) DO NOTHING;

-- Real-estate → tabs
INSERT INTO public.catalog_groups (domain, group_key, display, tab_key, tab_order) VALUES
  ('real_estate', 'overview',  'tab', 'overview', 0),
  ('real_estate', 'features',  'tab', 'features', 1),
  ('real_estate', 'location',  'tab', 'location', 2),
  ('real_estate', 'financials','tab', 'financials',3)
ON CONFLICT (domain, group_key) DO NOTHING;

-- Fashion → sections
INSERT INTO public.catalog_groups (domain, group_key, display, tab_key, tab_order) VALUES
  ('fashion', 'details',   'section', NULL, 0),
  ('fashion', 'materials', 'section', NULL, 1),
  ('fashion', 'care',      'section', NULL, 2)
ON CONFLICT (domain, group_key) DO NOTHING;

-- Home → sections
INSERT INTO public.catalog_groups (domain, group_key, display, tab_key, tab_order) VALUES
  ('home', 'details',   'section', NULL, 0),
  ('home', 'condition', 'section', NULL, 1),
  ('home', 'dimensions','section', NULL, 2)
ON CONFLICT (domain, group_key) DO NOTHING;

-- Electronics → sections
INSERT INTO public.catalog_groups (domain, group_key, display, tab_key, tab_order) VALUES
  ('electronics', 'specs',       'section', NULL, 0),
  ('electronics', 'connectivity','section', NULL, 1),
  ('electronics', 'condition',   'section', NULL, 2)
ON CONFLICT (domain, group_key) DO NOTHING;
