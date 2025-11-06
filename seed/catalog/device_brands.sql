-- Seed Data: Device Brands for Electronics
-- To be run after 20251105215000_electronics_extended.sql migration

INSERT INTO public.device_brands (slug, name, logo_url, device_types, is_active, sort_order) VALUES
  -- Top Phone/Tablet Brands
  ('apple', 'Apple', NULL, ARRAY['phone', 'tablet', 'laptop', 'desktop', 'watch'], true, 1),
  ('samsung', 'Samsung', NULL, ARRAY['phone', 'tablet', 'tv', 'monitor'], true, 2),
  ('xiaomi', 'Xiaomi', NULL, ARRAY['phone', 'tablet', 'watch'], true, 3),
  ('google', 'Google', NULL, ARRAY['phone', 'tablet'], true, 4),
  ('huawei', 'Huawei', NULL, ARRAY['phone', 'tablet', 'watch'], true, 5),
  ('oppo', 'OPPO', NULL, ARRAY['phone'], true, 6),
  ('oneplus', 'OnePlus', NULL, ARRAY['phone', 'tablet'], true, 7),
  ('motorola', 'Motorola', NULL, ARRAY['phone'], true, 8),
  ('nokia', 'Nokia', NULL, ARRAY['phone'], true, 9),
  ('realme', 'Realme', NULL, ARRAY['phone'], true, 10),
  
  -- Laptop/Desktop Brands
  ('lenovo', 'Lenovo', NULL, ARRAY['laptop', 'desktop', 'tablet', 'monitor'], true, 11),
  ('dell', 'Dell', NULL, ARRAY['laptop', 'desktop', 'monitor'], true, 12),
  ('hp', 'HP', NULL, ARRAY['laptop', 'desktop', 'printer', 'monitor'], true, 13),
  ('asus', 'ASUS', NULL, ARRAY['laptop', 'desktop', 'monitor', 'phone'], true, 14),
  ('acer', 'Acer', NULL, ARRAY['laptop', 'desktop', 'monitor'], true, 15),
  ('msi', 'MSI', NULL, ARRAY['laptop', 'desktop', 'monitor'], true, 16),
  ('microsoft', 'Microsoft', NULL, ARRAY['laptop', 'tablet', 'console'], true, 17),
  
  -- Camera Brands
  ('canon', 'Canon', NULL, ARRAY['camera', 'printer'], true, 18),
  ('nikon', 'Nikon', NULL, ARRAY['camera'], true, 19),
  ('sony', 'Sony', NULL, ARRAY['camera', 'tv', 'audio', 'console'], true, 20),
  ('panasonic', 'Panasonic', NULL, ARRAY['camera', 'tv'], true, 21),
  ('fujifilm', 'Fujifilm', NULL, ARRAY['camera'], true, 22),
  ('gopro', 'GoPro', NULL, ARRAY['camera'], true, 23),
  ('dji', 'DJI', NULL, ARRAY['camera', 'other'], true, 24),
  
  -- TV/Audio Brands
  ('lg', 'LG', NULL, ARRAY['tv', 'monitor', 'phone'], true, 25),
  ('philips', 'Philips', NULL, ARRAY['tv', 'audio', 'monitor'], true, 26),
  ('tcl', 'TCL', NULL, ARRAY['tv'], true, 27),
  ('hisense', 'Hisense', NULL, ARRAY['tv'], true, 28),
  ('bose', 'Bose', NULL, ARRAY['audio'], true, 29),
  ('jbl', 'JBL', NULL, ARRAY['audio'], true, 30),
  ('harman-kardon', 'Harman Kardon', NULL, ARRAY['audio'], true, 31),
  ('sonos', 'Sonos', NULL, ARRAY['audio'], true, 32),
  
  -- Gaming Console Brands
  ('nintendo', 'Nintendo', NULL, ARRAY['console'], true, 33),
  
  -- Smartwatch Brands
  ('garmin', 'Garmin', NULL, ARRAY['watch'], true, 34),
  ('fitbit', 'Fitbit', NULL, ARRAY['watch'], true, 35),
  
  -- Other Brands
  ('amazon', 'Amazon', NULL, ARRAY['tablet', 'audio', 'other'], true, 36),
  ('bosch', 'Bosch', NULL, ARRAY['other'], true, 37),
  ('dyson', 'Dyson', NULL, ARRAY['other'], true, 38)
ON CONFLICT (slug) DO NOTHING;

