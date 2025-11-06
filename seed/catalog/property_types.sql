-- Seed Data: Property Types for Real Estate
-- To be run after 20251105213527_catalog_dictionaries.sql migration

INSERT INTO public.property_types (slug, name_nl, name_fr, name_en, name_de, name_ru, category, sort_order) VALUES
  -- Residential - Apartments
  ('studio', 'Studio', 'Studio', 'Studio', 'Studio', 'Студия', 'residential', 1),
  ('apartment', 'Appartement', 'Appartement', 'Apartment', 'Wohnung', 'Квартира', 'residential', 2),
  ('duplex', 'Duplex', 'Duplex', 'Duplex', 'Duplex', 'Дуплекс', 'residential', 3),
  ('loft', 'Loft', 'Loft', 'Loft', 'Loft', 'Лофт', 'residential', 4),
  ('penthouse', 'Penthouse', 'Penthouse', 'Penthouse', 'Penthouse', 'Пентхаус', 'residential', 5),
  
  -- Residential - Houses
  ('house', 'Huis', 'Maison', 'House', 'Haus', 'Дом', 'residential', 10),
  ('villa', 'Villa', 'Villa', 'Villa', 'Villa', 'Вилла', 'residential', 11),
  ('townhouse', 'Rijhuis', 'Maison de maître', 'Townhouse', 'Reihenhaus', 'Таунхаус', 'residential', 12),
  ('cottage', 'Bungalow', 'Cottage', 'Cottage', 'Ferienhaus', 'Коттедж', 'residential', 13),
  ('farmhouse', 'Boerderij', 'Ferme', 'Farmhouse', 'Bauernhaus', 'Ферма', 'residential', 14),
  ('castle', 'Kasteel', 'Château', 'Castle', 'Schloss', 'Замок', 'residential', 15),
  
  -- Land
  ('building_land', 'Bouwgrond', 'Terrain à bâtir', 'Building Land', 'Baugrundstück', 'Участок под застройку', 'land', 20),
  ('agricultural_land', 'Landbouwgrond', 'Terre agricole', 'Agricultural Land', 'Landwirtschaftliches Land', 'Сельскохозяйственная земля', 'land', 21),
  ('forest', 'Bos', 'Forêt', 'Forest', 'Wald', 'Лес', 'land', 22),
  
  -- Commercial
  ('office', 'Kantoor', 'Bureau', 'Office', 'Büro', 'Офис', 'commercial', 30),
  ('retail_space', 'Winkelruimte', 'Commerce', 'Retail Space', 'Einzelhandelsfläche', 'Торговое помещение', 'commercial', 31),
  ('restaurant', 'Restaurant', 'Restaurant', 'Restaurant', 'Restaurant', 'Ресторан', 'commercial', 32),
  ('warehouse', 'Magazijn', 'Entrepôt', 'Warehouse', 'Lagerhaus', 'Склад', 'commercial', 33),
  ('industrial', 'Industrieel', 'Industriel', 'Industrial', 'Industrie', 'Промышленное помещение', 'commercial', 34),
  ('hotel', 'Hotel', 'Hôtel', 'Hotel', 'Hotel', 'Отель', 'commercial', 35),
  
  -- Parking/Storage
  ('garage', 'Garage', 'Garage', 'Garage', 'Garage', 'Гараж', 'parking', 40),
  ('parking_space', 'Parkeerplaats', 'Place de parking', 'Parking Space', 'Parkplatz', 'Парковочное место', 'parking', 41),
  ('carport', 'Carport', 'Carport', 'Carport', 'Carport', 'Навес', 'parking', 42),
  ('storage_unit', 'Opslagruimte', 'Box de rangement', 'Storage Unit', 'Lagerraum', 'Кладовая', 'parking', 43)
ON CONFLICT (slug) DO NOTHING;

