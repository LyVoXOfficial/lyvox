-- Vehicle reference tables migration
-- Creates all necessary reference tables for vehicle forms

-- 1. Steering Wheel Table
CREATE TABLE IF NOT EXISTS public.steering_wheel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_ru text NOT NULL,
  name_nl text,
  name_fr text,
  name_de text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Vehicle Colors Table
CREATE TABLE IF NOT EXISTS public.vehicle_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_ru text NOT NULL,
  name_nl text,
  name_fr text,
  name_de text,
  hex_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Vehicle Doors Table
CREATE TABLE IF NOT EXISTS public.vehicle_doors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  count integer NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_ru text NOT NULL,
  name_nl text,
  name_fr text,
  name_de text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Vehicle Conditions Table
CREATE TABLE IF NOT EXISTS public.vehicle_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_ru text NOT NULL,
  name_nl text,
  name_fr text,
  name_de text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Engine Types Table
CREATE TABLE IF NOT EXISTS public.engine_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  category text,
  name_en text NOT NULL,
  name_ru text NOT NULL,
  name_nl text,
  name_fr text,
  name_de text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add category column if table already exists without it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'engine_types' 
                 AND column_name = 'category') THEN
    ALTER TABLE public.engine_types ADD COLUMN category text;
  END IF;
END$$;

-- 6. Drive Types Table
CREATE TABLE IF NOT EXISTS public.drive_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_ru text NOT NULL,
  name_nl text,
  name_fr text,
  name_de text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Vehicle Options Table
CREATE TABLE IF NOT EXISTS public.vehicle_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  code text NOT NULL,
  name_en text NOT NULL,
  name_ru text NOT NULL,
  name_nl text,
  name_fr text,
  name_de text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category, code)
);

-- Seed data for Steering Wheel
INSERT INTO public.steering_wheel (code, name_en, name_ru, name_nl, name_fr, name_de) VALUES
  ('left', 'Left', 'Левый', 'Links', 'Gauche', 'Links'),
  ('right', 'Right', 'Правый', 'Rechts', 'Droite', 'Rechts')
ON CONFLICT (code) DO NOTHING;

-- Seed data for Vehicle Colors
INSERT INTO public.vehicle_colors (code, name_en, name_ru, name_nl, name_fr, name_de, hex_code) VALUES
  ('white', 'White', 'Белый', 'Wit', 'Blanc', 'Weiß', '#FFFFFF'),
  ('black', 'Black', 'Черный', 'Zwart', 'Noir', 'Schwarz', '#000000'),
  ('silver', 'Silver', 'Серебристый', 'Zilver', 'Argent', 'Silber', '#C0C0C0'),
  ('gray', 'Gray', 'Серый', 'Grijs', 'Gris', 'Grau', '#808080'),
  ('red', 'Red', 'Красный', 'Rood', 'Rouge', 'Rot', '#FF0000'),
  ('blue', 'Blue', 'Синий', 'Blauw', 'Bleu', 'Blau', '#0000FF'),
  ('green', 'Green', 'Зеленый', 'Groen', 'Vert', 'Grün', '#008000'),
  ('yellow', 'Yellow', 'Желтый', 'Geel', 'Jaune', 'Gelb', '#FFFF00'),
  ('orange', 'Orange', 'Оранжевый', 'Oranje', 'Orange', 'Orange', '#FFA500'),
  ('brown', 'Brown', 'Коричневый', 'Bruin', 'Marron', 'Braun', '#8B4513'),
  ('beige', 'Beige', 'Бежевый', 'Beige', 'Beige', 'Beige', '#F5F5DC'),
  ('gold', 'Gold', 'Золотой', 'Goud', 'Or', 'Gold', '#FFD700'),
  ('purple', 'Purple', 'Фиолетовый', 'Paars', 'Violet', 'Lila', '#800080')
ON CONFLICT (code) DO NOTHING;

-- Seed data for Vehicle Doors
INSERT INTO public.vehicle_doors (count, name_en, name_ru, name_nl, name_fr, name_de) VALUES
  (2, '2 doors', '2 двери', '2 deuren', '2 portes', '2 Türen'),
  (3, '3 doors', '3 двери', '3 deuren', '3 portes', '3 Türen'),
  (4, '4 doors', '4 двери', '4 deuren', '4 portes', '4 Türen'),
  (5, '5 doors', '5 дверей', '5 deuren', '5 portes', '5 Türen')
ON CONFLICT (count) DO NOTHING;

-- Seed data for Vehicle Conditions
INSERT INTO public.vehicle_conditions (code, name_en, name_ru, name_nl, name_fr, name_de) VALUES
  ('not_damaged', 'Not damaged', 'Не поврежден', 'Niet beschadigd', 'Non endommagé', 'Nicht beschädigt'),
  ('damaged', 'Damaged', 'Поврежден', 'Beschadigd', 'Endommagé', 'Beschädigt'),
  ('salvage', 'Salvage', 'После ДТП', 'Bergingsauto', 'Épave', 'Totalschaden')
ON CONFLICT (code) DO NOTHING;

-- Seed data for Engine Types
INSERT INTO public.engine_types (code, category, name_en, name_ru, name_nl, name_fr, name_de) VALUES
  ('petrol', 'fuel', 'Petrol', 'Бензин', 'Benzine', 'Essence', 'Benzin'),
  ('diesel', 'fuel', 'Diesel', 'Дизель', 'Diesel', 'Diesel', 'Diesel'),
  ('electric', 'fuel', 'Electric', 'Электро', 'Elektrisch', 'Électrique', 'Elektrisch'),
  ('hybrid', 'fuel', 'Hybrid', 'Гибрид', 'Hybride', 'Hybride', 'Hybrid'),
  ('plugin_hybrid', 'fuel', 'Plug-in Hybrid', 'Подключаемый гибрид', 'Plug-in Hybride', 'Hybride rechargeable', 'Plug-in-Hybrid'),
  ('hydrogen', 'fuel', 'Hydrogen', 'Водород', 'Waterstof', 'Hydrogène', 'Wasserstoff')
ON CONFLICT (code) DO NOTHING;

-- Seed data for Drive Types
INSERT INTO public.drive_types (code, name_en, name_ru, name_nl, name_fr, name_de) VALUES
  ('fwd', 'Front-wheel drive', 'Передний привод', 'Voorwielaandrijving', 'Traction avant', 'Frontantrieb'),
  ('rwd', 'Rear-wheel drive', 'Задний привод', 'Achterwielaandrijving', 'Propulsion', 'Heckantrieb'),
  ('awd', 'All-wheel drive', 'Полный привод', 'Vierwielaandrijving', 'Quatre roues motrices', 'Allradantrieb'),
  ('4wd', 'Four-wheel drive', 'Полный привод 4x4', 'Vierwielaandrijving', 'Quatre roues motrices', 'Allradantrieb')
ON CONFLICT (code) DO NOTHING;

-- Seed data for Vehicle Options
INSERT INTO public.vehicle_options (category, code, name_en, name_ru, name_nl, name_fr, name_de) VALUES
  -- Comfort options
  ('comfort', 'heated_seats', 'Heated seats', 'Подогрев сидений', 'Verwarmde stoelen', 'Sièges chauffants', 'Sitzheizung'),
  ('comfort', 'ventilated_seats', 'Ventilated seats', 'Вентиляция сидений', 'Geventileerde stoelen', 'Sièges ventilés', 'Sitzbelüftung'),
  ('comfort', 'leather_seats', 'Leather seats', 'Кожаные сиденья', 'Leren stoelen', 'Sièges en cuir', 'Ledersitze'),
  ('comfort', 'electric_seats', 'Electric seats', 'Электросиденья', 'Elektrische stoelen', 'Sièges électriques', 'Elektrische Sitze'),
  ('comfort', 'memory_seats', 'Memory seats', 'Память сидений', 'Geheugenstoelen', 'Sièges à mémoire', 'Sitze mit Memory-Funktion'),
  ('comfort', 'cruise_control', 'Cruise control', 'Круиз-контроль', 'Cruise control', 'Régulateur de vitesse', 'Tempomat'),
  ('comfort', 'climate_control', 'Climate control', 'Климат-контроль', 'Klimaatbeheersing', 'Climatisation automatique', 'Klimaautomatik'),
  ('comfort', 'air_conditioning', 'Air conditioning', 'Кондиционер', 'Airconditioning', 'Climatisation', 'Klimaanlage'),
  
  -- Safety options
  ('safety', 'abs', 'ABS', 'ABS', 'ABS', 'ABS', 'ABS'),
  ('safety', 'asr', 'ASR / Traction control', 'ASR / Контроль тяги', 'ASR / Tractiecontrole', 'ASR / Contrôle de traction', 'ASR / Traktionskontrolle'),
  ('safety', 'esp', 'ESP / Stability control', 'ESP / Система стабилизации', 'ESP / Stabiliteitscontrole', 'ESP / Contrôle de stabilité', 'ESP / Stabilitätskontrolle'),
  ('safety', 'airbags', 'Airbags', 'Подушки безопасности', 'Airbags', 'Airbags', 'Airbags'),
  ('safety', 'parking_sensors', 'Parking sensors', 'Парктроники', 'Parkeersensoren', 'Capteurs de stationnement', 'Einparkhilfe'),
  ('safety', 'rear_camera', 'Rear camera', 'Камера заднего вида', 'Achteruitrijcamera', 'Caméra de recul', 'Rückfahrkamera'),
  ('safety', 'blind_spot', 'Blind spot monitoring', 'Контроль слепых зон', 'Dodehoekdetectie', 'Surveillance angle mort', 'Totwinkel-Assistent'),
  ('safety', 'lane_assist', 'Lane assist', 'Контроль полосы движения', 'Rijstrookassistent', 'Aide au maintien de voie', 'Spurhalteassistent'),
  
  -- Multimedia options
  ('multimedia', 'navigation', 'Navigation', 'Навигация', 'Navigatie', 'Navigation', 'Navigation'),
  ('multimedia', 'bluetooth', 'Bluetooth', 'Bluetooth', 'Bluetooth', 'Bluetooth', 'Bluetooth'),
  ('multimedia', 'usb', 'USB', 'USB', 'USB', 'USB', 'USB'),
  ('multimedia', 'aux', 'AUX', 'AUX', 'AUX', 'AUX', 'AUX'),
  ('multimedia', 'apple_carplay', 'Apple CarPlay', 'Apple CarPlay', 'Apple CarPlay', 'Apple CarPlay', 'Apple CarPlay'),
  ('multimedia', 'android_auto', 'Android Auto', 'Android Auto', 'Android Auto', 'Android Auto', 'Android Auto'),
  ('multimedia', 'premium_audio', 'Premium audio', 'Премиум аудио', 'Premium audio', 'Audio premium', 'Premium-Audio'),
  
  -- Exterior options
  ('exterior', 'sunroof', 'Sunroof', 'Люк', 'Zonnedak', 'Toit ouvrant', 'Schiebedach'),
  ('exterior', 'panoramic_roof', 'Panoramic roof', 'Панорамная крыша', 'Panoramadak', 'Toit panoramique', 'Panoramadach'),
  ('exterior', 'led_lights', 'LED lights', 'LED фары', 'LED-verlichting', 'Feux LED', 'LED-Scheinwerfer'),
  ('exterior', 'xenon_lights', 'Xenon lights', 'Ксеноновые фары', 'Xenon-verlichting', 'Feux xénon', 'Xenon-Scheinwerfer'),
  ('exterior', 'alloy_wheels', 'Alloy wheels', 'Литые диски', 'Lichtmetalen velgen', 'Jantes alliage', 'Leichtmetallfelgen'),
  ('exterior', 'tow_hitch', 'Tow hitch', 'Фаркоп', 'Trekhaak', 'Attelage', 'Anhängerkupplung')
ON CONFLICT (category, code) DO NOTHING;

-- RLS Policies - all tables are read-only for public
ALTER TABLE public.steering_wheel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_doors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engine_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_options ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "public_read_steering_wheel" ON public.steering_wheel FOR SELECT USING (true);
CREATE POLICY "public_read_vehicle_colors" ON public.vehicle_colors FOR SELECT USING (true);
CREATE POLICY "public_read_vehicle_doors" ON public.vehicle_doors FOR SELECT USING (true);
CREATE POLICY "public_read_vehicle_conditions" ON public.vehicle_conditions FOR SELECT USING (true);
CREATE POLICY "public_read_engine_types" ON public.engine_types FOR SELECT USING (true);
CREATE POLICY "public_read_drive_types" ON public.drive_types FOR SELECT USING (true);
CREATE POLICY "public_read_vehicle_options" ON public.vehicle_options FOR SELECT USING (true);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS steering_wheel_code_idx ON public.steering_wheel(code);
CREATE INDEX IF NOT EXISTS vehicle_colors_code_idx ON public.vehicle_colors(code);
CREATE INDEX IF NOT EXISTS vehicle_doors_count_idx ON public.vehicle_doors(count);
CREATE INDEX IF NOT EXISTS vehicle_conditions_code_idx ON public.vehicle_conditions(code);
CREATE INDEX IF NOT EXISTS engine_types_code_idx ON public.engine_types(code);
CREATE INDEX IF NOT EXISTS drive_types_code_idx ON public.drive_types(code);
CREATE INDEX IF NOT EXISTS vehicle_options_category_code_idx ON public.vehicle_options(category, code);

-- Comments
COMMENT ON TABLE public.steering_wheel IS 'Steering wheel position options for vehicles';
COMMENT ON TABLE public.vehicle_colors IS 'Vehicle color options with translations';
COMMENT ON TABLE public.vehicle_doors IS 'Number of doors options for vehicles';
COMMENT ON TABLE public.vehicle_conditions IS 'Vehicle condition states (not damaged, damaged, salvage)';
COMMENT ON TABLE public.engine_types IS 'Engine/fuel type options for vehicles';
COMMENT ON TABLE public.drive_types IS 'Drive type options (FWD, RWD, AWD, 4WD)';
COMMENT ON TABLE public.vehicle_options IS 'Vehicle optional equipment and features';

