-- Seed Data: Belgium EPC Energy Ratings
-- To be run after 20251105213527_catalog_dictionaries.sql migration
-- Based on Belgium energy performance certificate standards

INSERT INTO public.epc_ratings (code, name_nl, name_fr, name_en, name_de, name_ru, max_kwh_per_sqm_year, color_hex, sort_order) VALUES
  ('A++', 'A++', 'A++', 'A++', 'A++', 'A++', 45, '#00A651', 1),
  ('A+', 'A+', 'A+', 'A+', 'A+', 'A+', 62, '#4CAF50', 2),
  ('A', 'A', 'A', 'A', 'A', 'A', 100, '#8BC34A', 3),
  ('B', 'B', 'B', 'B', 'B', 'B', 150, '#CDDC39', 4),
  ('C', 'C', 'C', 'C', 'C', 'C', 200, '#FFEB3B', 5),
  ('D', 'D', 'D', 'D', 'D', 'D', 260, '#FFC107', 6),
  ('E', 'E', 'E', 'E', 'E', 'E', 340, '#FF9800', 7),
  ('F', 'F', 'F', 'F', 'F', 'F', 430, '#FF5722', 8),
  ('G', 'G', 'G', 'G', 'G', 'G', NULL, '#F44336', 9) -- No upper limit
ON CONFLICT (code) DO NOTHING;

