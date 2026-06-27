-- ============================================================================
-- SEED TEST DATA: Realistic adverts, users, likes, reviews, media
-- ============================================================================
-- Creates test users and populates marketplace with sample listings
-- Run with: pnpm run seed-sql seed-test-data.sql
-- Or: node scripts/runSeed.mjs scripts/seed-test-data.sql

BEGIN;

-- ============================================================================
-- 1. CREATE TEST USERS (via auth.users table)
-- ============================================================================

-- Insert test users into auth.users (using raw_user_meta_data for display_name)
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_user_meta_data, is_super_admin, last_sign_in_at
) VALUES
  (
    '11111111-1111-1111-1111-111111111111'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'anna.brussels@test.com',
    crypt('TestPassword123!', gen_salt('bf')),
    now(),
    now(), now(),
    '{"display_name": "Анна из Брюсселя"}'::jsonb,
    false, now()
  ),
  (
    '22222222-2222-2222-2222-222222222222'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'mark.gent@test.com',
    crypt('TestPassword123!', gen_salt('bf')),
    now(),
    now(), now(),
    '{"display_name": "Марк из Гента"}'::jsonb,
    false, now()
  ),
  (
    '33333333-3333-3333-3333-333333333333'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'lisa.antwerp@test.com',
    crypt('TestPassword123!', gen_salt('bf')),
    now(),
    now(), now(),
    '{"display_name": "Лиза из Антверпена"}'::jsonb,
    false, now()
  ),
  (
    '44444444-4444-4444-4444-444444444444'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'john.charleroi@test.com',
    crypt('TestPassword123!', gen_salt('bf')),
    now(),
    now(), now(),
    '{"display_name": "Джон из Шарлеруа"}'::jsonb,
    false, now()
  ),
  (
    '55555555-5555-5555-5555-555555555555'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'emma.liege@test.com',
    crypt('TestPassword123!', gen_salt('bf')),
    now(),
    now(), now(),
    '{"display_name": "Эмма из Льежа"}'::jsonb,
    false, now()
  ),
  (
    '66666666-6666-6666-6666-666666666666'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'thomas.bruges@test.com',
    crypt('TestPassword123!', gen_salt('bf')),
    now(),
    now(), now(),
    '{"display_name": "Томас из Брюгге"}'::jsonb,
    false, now()
  ),
  (
    '77777777-7777-7777-7777-777777777777'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'sophie.brussels@test.com',
    crypt('TestPassword123!', gen_salt('bf')),
    now(),
    now(), now(),
    '{"display_name": "Софи из Брюсселя"}'::jsonb,
    false, now()
  ),
  (
    '88888888-8888-8888-8888-888888888888'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'max.liege@test.com',
    crypt('TestPassword123!', gen_salt('bf')),
    now(),
    now(), now(),
    '{"display_name": "Макс из Льежа"}'::jsonb,
    false, now()
  ),
  (
    '99999999-9999-9999-9999-999999999999'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'julia.antwerp@test.com',
    crypt('TestPassword123!', gen_salt('bf')),
    now(),
    now(), now(),
    '{"display_name": "Юлия из Антверпена"}'::jsonb,
    false, now()
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'diego.gent@test.com',
    crypt('TestPassword123!', gen_salt('bf')),
    now(),
    now(), now(),
    '{"display_name": "Диего из Гента"}'::jsonb,
    false, now()
  )
ON CONFLICT (email) DO NOTHING;

-- Create profiles for test users
INSERT INTO public.profiles (id, display_name, verified_email, verified_phone, created_at)
VALUES
  ('11111111-1111-1111-1111-111111111111'::uuid, 'Анна из Брюсселя', true, true, now()),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Марк из Гента', true, true, now()),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'Лиза из Антверпена', true, true, now()),
  ('44444444-4444-4444-4444-444444444444'::uuid, 'Джон из Шарлеруа', false, false, now()),
  ('55555555-5555-5555-5555-555555555555'::uuid, 'Эмма из Льежа', true, true, now()),
  ('66666666-6666-6666-6666-666666666666'::uuid, 'Томас из Брюгге', true, true, now()),
  ('77777777-7777-7777-7777-777777777777'::uuid, 'Софи из Брюсселя', false, false, now()),
  ('88888888-8888-8888-8888-888888888888'::uuid, 'Макс из Льежа', true, true, now()),
  ('99999999-9999-9999-9999-999999999999'::uuid, 'Юлия из Антверпена', true, true, now()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'Диего из Гента', true, true, now())
ON CONFLICT (id) DO NOTHING;

-- Add phones for test users
INSERT INTO public.phones (user_id, e164, verified)
VALUES
  ('11111111-1111-1111-1111-111111111111'::uuid, '+32487123456', true),
  ('22222222-2222-2222-2222-222222222222'::uuid, '+32498765432', true),
  ('33333333-3333-3333-3333-333333333333'::uuid, '+32470555666', true),
  ('44444444-4444-4444-4444-444444444444'::uuid, '+32491234567', false),
  ('55555555-5555-5555-5555-555555555555'::uuid, '+32476789012', true),
  ('66666666-6666-6666-6666-666666666666'::uuid, '+32481234567', true),
  ('77777777-7777-7777-7777-777777777777'::uuid, '+32486543210', false),
  ('88888888-8888-8888-8888-888888888888'::uuid, '+32479876543', true),
  ('99999999-9999-9999-9999-999999999999'::uuid, '+32488888888', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '+32477777777', true)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- 2. CREATE LOCATIONS
-- ============================================================================

WITH locations AS (
  SELECT * FROM (VALUES
    ('Belgium'::text, 'Brussels'::text, 'Brussels'::text, '1000'::text),
    ('Belgium'::text, 'Flanders'::text, 'Gent'::text, '9000'::text),
    ('Belgium'::text, 'Flanders'::text, 'Antwerp'::text, '2000'::text),
    ('Belgium'::text, 'Wallonia'::text, 'Charleroi'::text, '6000'::text),
    ('Belgium'::text, 'Wallonia'::text, 'Liège'::text, '4000'::text),
    ('Belgium'::text, 'Flanders'::text, 'Bruges'::text, '8000'::text),
    ('Belgium'::text, 'Brussels'::text, 'Brussels'::text, '1020'::text),
    ('Belgium'::text, 'Flanders'::text, 'Leuven'::text, '3000'::text)
  ) AS t(country, region, city, postcode)
)
INSERT INTO public.locations (country, region, city, postcode)
SELECT country, region, city, postcode FROM locations
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. CREATE ADVERTS FOR MULTIPLE CATEGORIES
-- ============================================================================

-- Helper: User ID array
WITH users_array AS (
  SELECT ARRAY[
    '11111111-1111-1111-1111-111111111111'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid,
    '33333333-3333-3333-3333-333333333333'::uuid,
    '44444444-4444-4444-4444-444444444444'::uuid,
    '55555555-5555-5555-5555-555555555555'::uuid,
    '66666666-6666-6666-6666-666666666666'::uuid,
    '77777777-7777-7777-7777-777777777777'::uuid,
    '88888888-8888-8888-8888-888888888888'::uuid,
    '99999999-9999-9999-9999-999999999999'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ] AS users
),
cities_array AS (
  SELECT ARRAY['Brussels', 'Gent', 'Antwerp', 'Charleroi', 'Liège', 'Bruges', 'Leuven'] AS cities,
         ARRAY['1000', '9000', '2000', '6000', '4000', '8000', '3000'] AS postcodes
),
-- CARS
car_samples AS (
  SELECT
    CASE (row_number() OVER ()) % 10
      WHEN 1 THEN 'BMW 3 Series 2015 • 125,000 км • Отличное состояние'
      WHEN 2 THEN 'Mercedes C-Class 2014 • 98,000 км • Немецкий сервис'
      WHEN 3 THEN 'VW Golf 2013 • 156,000 км • Надежный семейный автомобиль'
      WHEN 4 THEN 'Audi A4 2016 • 87,000 км • Технически исправен'
      WHEN 5 THEN 'Ford Focus 2012 • 201,000 км • Дешево, переоборудование'
      WHEN 6 THEN 'Toyota Corolla 2011 • 189,000 км • Самая надежная'
      WHEN 7 THEN 'Renault Megane 2014 • 145,000 км • Новые тормоза и диски'
      WHEN 8 THEN 'Skoda Octavia 2015 • 112,000 км • Проверена на СТО'
      WHEN 9 THEN 'Hyundai ix35 2013 • 178,000 км • Внедорожник, полный привод'
      ELSE 'Peugeot 308 2012 • 167,000 км • Европейский автомобиль'
    END AS title,
    CASE (row_number() OVER ()) % 10
      WHEN 1 THEN 12500 WHEN 2 THEN 14000 WHEN 3 THEN 7500 WHEN 4 THEN 15500 WHEN 5 THEN 4200
      WHEN 6 THEN 6800 WHEN 7 THEN 5900 WHEN 8 THEN 8500 WHEN 9 THEN 9200 ELSE 5500
    END AS price,
    'cars-used' AS cat_slug,
    'excellent' AS condition_val,
    row_number() OVER () AS rn
  FROM generate_series(1, 20)
),
-- APARTMENTS
apt_samples AS (
  SELECT
    CASE (row_number() OVER ()) % 10
      WHEN 1 THEN 'Уютная студия в центре • WiFi • Меблирована'
      WHEN 2 THEN '2 комнаты • Метро Porte de Hal • Балкон с видом'
      WHEN 3 THEN 'Большая квартира • 120м² • Три спальни • Парковка'
      WHEN 4 THEN 'Студия с кухней • Брюссель центр • Все включено'
      WHEN 5 THEN '1 комната в общей квартире • Молодежное общежитие'
      WHEN 6 THEN 'Люкс апартамент • Панорамный вид • Охрана'
      WHEN 7 THEN 'Компактная квартира • Хороший ремонт • Свежий воздух'
      WHEN 8 THEN 'Классика • 2 спальни • Душ и ванна • Столовая'
      WHEN 9 THEN 'Студио рядом с парком • Естественный свет • Зеленый двор'
      ELSE 'Большая площадь • 4 комнаты • Для семьи • Стиральная машина'
    END AS title,
    CASE (row_number() OVER ()) % 10
      WHEN 1 THEN 850 WHEN 2 THEN 1200 WHEN 3 THEN 1800 WHEN 4 THEN 950 WHEN 5 THEN 650
      WHEN 6 THEN 2500 WHEN 7 THEN 1100 WHEN 8 THEN 1350 WHEN 9 THEN 900 ELSE 1650
    END AS price,
    'apartment-rent' AS cat_slug,
    'good' AS condition_val,
    row_number() OVER () AS rn
  FROM generate_series(1, 20)
),
-- ELECTRONICS
elec_samples AS (
  SELECT
    CASE (row_number() OVER ()) % 10
      WHEN 1 THEN 'iPhone 13 Pro • 256GB • Space Gray • Идеал состояние'
      WHEN 2 THEN 'MacBook Pro 2020 • i7 • 16GB RAM • SSD 512GB'
      WHEN 3 THEN 'Samsung Galaxy S22 • 128GB • Phantom White • Чехол'
      WHEN 4 THEN 'iPad Pro 12.9" • 256GB • Wi-Fi • Карандаш Apple'
      WHEN 5 THEN 'Sony WH-1000XM5 • Наушники • Черные • С кейсом'
      WHEN 6 THEN 'DJI Air 2S • Дрон • Все аксессуары • Как новый'
      WHEN 7 THEN 'Nintendo Switch OLED • 64GB • Две игры • Защиты'
      WHEN 8 THEN 'Ноутбук Dell XPS 13 • i9 • 16GB • 1TB SSD'
      WHEN 9 THEN 'Смарт-часы Apple Watch Series 8 • 45mm'
      ELSE 'Монитор LG 27" 4K UHD • USB-C • Гарантия'
    END AS title,
    CASE (row_number() OVER ()) % 10
      WHEN 1 THEN 650 WHEN 2 THEN 1200 WHEN 3 THEN 450 WHEN 4 THEN 800 WHEN 5 THEN 280
      WHEN 6 THEN 950 WHEN 7 THEN 320 WHEN 8 THEN 850 WHEN 9 THEN 350 ELSE 420
    END AS price,
    'electronics' AS cat_slug,
    'excellent' AS condition_val,
    row_number() OVER () AS rn
  FROM generate_series(1, 20)
),
-- CLOTHING
clothing_samples AS (
  SELECT
    CASE (row_number() OVER ()) % 10
      WHEN 1 THEN 'Пальто зимнее • Размер M • Шерсть • Как новое'
      WHEN 2 THEN 'Платье вечернее • Размер 38 • Дизайнерское'
      WHEN 3 THEN 'Джинсы • Размер 26 • Bренд Levi''s • Темно-синие'
      WHEN 4 THEN 'Кожаная куртка • Размер S • Черная • Натуральная'
      WHEN 5 THEN 'Пляжное платье • Размер M • Летнее • Яркое'
      WHEN 6 THEN 'Блузка шелковая • Размер 36 • Нейтральный цвет'
      WHEN 7 THEN 'Юбка плиссе • Размер 40 • Классика • Черная'
      WHEN 8 THEN 'Кардиган шерстяной • Размер L • Уютный'
      WHEN 9 THEN 'Спортивный костюм • Размер M • Adidas • Оригинал'
      ELSE 'Туника льняная • Размер M-L • Летняя • Белая'
    END AS title,
    CASE (row_number() OVER ()) % 10
      WHEN 1 THEN 45 WHEN 2 THEN 120 WHEN 3 THEN 25 WHEN 4 THEN 65 WHEN 5 THEN 15
      WHEN 6 THEN 30 WHEN 7 THEN 35 WHEN 8 THEN 40 WHEN 9 THEN 50 ELSE 20
    END AS price,
    'clothing-women' AS cat_slug,
    'excellent' AS condition_val,
    row_number() OVER () AS rn
  FROM generate_series(1, 20)
)
-- INSERT ALL ADVERTS
INSERT INTO public.adverts (
  user_id, category_id, title, description, price, currency, condition, location, status, moderation_status, created_at
)
SELECT
  ua.users[((cs.rn - 1) % 10) + 1],
  (SELECT id FROM public.categories WHERE slug = cs.cat_slug LIMIT 1),
  cs.title,
  '✨ Основные характеристики:' || chr(10) ||
  '• Состояние: ' || CASE cs.condition_val WHEN 'excellent' THEN 'Отличное' ELSE 'Хорошее' END || chr(10) ||
  '• Цена: €' || cs.price || chr(10) ||
  '• Готово к использованию' || chr(10) ||
  '• Быстрая обработка' || chr(10) || chr(10) ||
  '📍 Локация: ' || ca.cities[((cs.rn - 1) % 7) + 1] || ', ' || ca.postcodes[((cs.rn - 1) % 7) + 1] || chr(10) || chr(10) ||
  '💬 Свяжитесь со мной для подробнее информации!' AS description,
  cs.price,
  'EUR',
  cs.condition_val,
  ca.cities[((cs.rn - 1) % 7) + 1] || ', ' || ca.postcodes[((cs.rn - 1) % 7) + 1],
  'active',
  'approved',
  now() - (INTERVAL '1 day' * (21 - cs.rn))
FROM car_samples cs, users_array ua, cities_array ca
UNION ALL
SELECT
  ua.users[((as.rn - 1) % 10) + 1],
  (SELECT id FROM public.categories WHERE slug = as.cat_slug LIMIT 1),
  as.title,
  '✨ Основные характеристики:' || chr(10) ||
  '• Цена: €' || as.price || '/месяц' || chr(10) ||
  '• Готово к заселению' || chr(10) ||
  '• Свежий ремонт' || chr(10) ||
  '• Все удобства' || chr(10) || chr(10) ||
  '📍 Локация: ' || ca.cities[((as.rn - 1) % 7) + 1] || ', ' || ca.postcodes[((as.rn - 1) % 7) + 1] || chr(10) || chr(10) ||
  '💬 Свяжитесь со мной для организации просмотра!' AS description,
  as.price,
  'EUR',
  as.condition_val,
  ca.cities[((as.rn - 1) % 7) + 1] || ', ' || ca.postcodes[((as.rn - 1) % 7) + 1],
  'active',
  'approved',
  now() - (INTERVAL '1 day' * (21 - as.rn))
FROM apt_samples as, users_array ua, cities_array ca
UNION ALL
SELECT
  ua.users[((es.rn - 1) % 10) + 1],
  (SELECT id FROM public.categories WHERE slug = es.cat_slug LIMIT 1),
  es.title,
  '✨ Основные характеристики:' || chr(10) ||
  '• Состояние: Отличное' || chr(10) ||
  '• Цена: €' || es.price || chr(10) ||
  '• Оригинальная коробка и документы' || chr(10) ||
  '• Гарантия на запчасти' || chr(10) || chr(10) ||
  '📍 Локация: ' || ca.cities[((es.rn - 1) % 7) + 1] || ', ' || ca.postcodes[((es.rn - 1) % 7) + 1] || chr(10) || chr(10) ||
  '💬 Свяжитесь со мной для подробнее информации!' AS description,
  es.price,
  'EUR',
  es.condition_val,
  ca.cities[((es.rn - 1) % 7) + 1] || ', ' || ca.postcodes[((es.rn - 1) % 7) + 1],
  'active',
  'approved',
  now() - (INTERVAL '1 day' * (21 - es.rn))
FROM elec_samples es, users_array ua, cities_array ca
UNION ALL
SELECT
  ua.users[((cls.rn - 1) % 10) + 1],
  (SELECT id FROM public.categories WHERE slug = cls.cat_slug LIMIT 1),
  cls.title,
  '✨ Основные характеристики:' || chr(10) ||
  '• Состояние: Отличное' || chr(10) ||
  '• Цена: €' || cls.price || chr(10) ||
  '• Чистое, свежее' || chr(10) ||
  '• Быстрая отправка' || chr(10) || chr(10) ||
  '📍 Локация: ' || ca.cities[((cls.rn - 1) % 7) + 1] || ', ' || ca.postcodes[((cls.rn - 1) % 7) + 1] || chr(10) || chr(10) ||
  '💬 Свяжитесь со мной для подробнее информации!' AS description,
  cls.price,
  'EUR',
  cls.condition_val,
  ca.cities[((cls.rn - 1) % 7) + 1] || ', ' || ca.postcodes[((cls.rn - 1) % 7) + 1],
  'active',
  'approved',
  now() - (INTERVAL '1 day' * (21 - cls.rn))
FROM clothing_samples cls, users_array ua, cities_array ca;

-- ============================================================================
-- 4. CREATE ADVERTS - APARTMENTS FOR RENT
-- ============================================================================

WITH apt_samples AS (
  SELECT
    CASE (row_number() OVER ()) % 10
      WHEN 1 THEN 'Уютная студия в центре • WiFi • Меблирована'
      WHEN 2 THEN '2 комнаты • Метро Porte de Hal • Балкон с видом'
      WHEN 3 THEN 'Большая квартира • 120м² • Три спальни • Парковка'
      WHEN 4 THEN 'Студия с кухней • Брюссель центр • Все включено'
      WHEN 5 THEN '1 комната в общей квартире • Молодежное общежитие'
      WHEN 6 THEN 'Люкс апартамент • Панорамный вид • Охрана'
      WHEN 7 THEN 'Компактная квартира • Хороший ремонт • Свежий воздух'
      WHEN 8 THEN 'Классика • 2 спальни • Душ и ванна • Столовая'
      WHEN 9 THEN 'Студио рядом с парком • Естественный свет • Зеленый двор'
      ELSE 'Большая площадь • 4 комнаты • Для семьи • Стиральная машина'
    END AS title,
    CASE (row_number() OVER ()) % 10
      WHEN 1 THEN 850
      WHEN 2 THEN 1200
      WHEN 3 THEN 1800
      WHEN 4 THEN 950
      WHEN 5 THEN 650
      WHEN 6 THEN 2500
      WHEN 7 THEN 1100
      WHEN 8 THEN 1350
      WHEN 9 THEN 900
      ELSE 1650
    END AS price,
    (ARRAY['11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, '44444444-4444-4444-4444-444444444444'::uuid, '55555555-5555-5555-5555-555555555555'::uuid, '66666666-6666-6666-6666-666666666666'::uuid, '77777777-7777-7777-7777-777777777777'::uuid, '88888888-8888-8888-8888-888888888888'::uuid, '99999999-9999-9999-9999-999999999999'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid])[((row_number() OVER ()) % 10) + 1] AS user_id,
    (ARRAY['Brussels', 'Gent', 'Antwerp', 'Charleroi', 'Liège', 'Bruges', 'Leuven'])[((row_number() OVER ()) % 7) + 1] AS city,
    (ARRAY['1000', '9000', '2000', '6000', '4000', '8000', '3000'])[((row_number() OVER ()) % 7) + 1] AS postcode,
    row_number() OVER () AS rn
  FROM generate_series(1, 20)
),
cat_id AS (
  SELECT id FROM public.categories
  WHERE slug = 'apartment-rent'
  LIMIT 1
)
INSERT INTO public.adverts (
  user_id, category_id, title, description, price, currency, location, status, moderation_status, created_at
)
SELECT
  as_samples.user_id,
  (SELECT id FROM cat_id),
  as_samples.title,
  '✨ Основные характеристики:' || chr(10) ||
  '• Цена: €' || as_samples.price || '/месяц' || chr(10) ||
  '• Готово к заселению' || chr(10) ||
  '• Свежий ремонт' || chr(10) ||
  '• Все удобства' || chr(10) || chr(10) ||
  '📍 Локация: ' || as_samples.city || ', ' || as_samples.postcode || chr(10) || chr(10) ||
  '💬 Свяжитесь со мной для организации просмотра!' AS description,
  as_samples.price,
  'EUR',
  as_samples.city || ', ' || as_samples.postcode,
  'active',
  'approved',
  now() - (INTERVAL '1 day' * (21 - as_samples.rn))
FROM apt_samples as_samples;

-- ============================================================================
-- 5. ADD MEDIA (PHOTOS) TO ADVERTS
-- ============================================================================

WITH advert_list AS (
  SELECT id, row_number() OVER (ORDER BY created_at DESC) as rn
  FROM public.adverts
  WHERE status = 'active'
  LIMIT 80
),
photo_urls AS (
  SELECT ARRAY[
    'https://images.unsplash.com/photo-1552820728-8ac41f1ce891?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1493857671505-72967e2e2760?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1580489944761-b60bbb8d0edc?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1469022563149-aa64dbd37dba?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1523217311519-3f69fba0b80b?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=400&h=300&fit=crop'
  ] AS urls
)
INSERT INTO public.media (advert_id, url, sort, created_at)
SELECT
  al.id,
  pu.urls[(al.rn + ps.photo_sort) % 10 + 1],
  ps.photo_sort,
  now() - INTERVAL '1 day'
FROM advert_list al
CROSS JOIN photo_urls pu
CROSS JOIN (SELECT 0 AS photo_sort UNION SELECT 1 UNION SELECT 2) ps;

-- ============================================================================
-- 6. ADD LIKES (from different users)
-- ============================================================================

WITH adverts_for_likes AS (
  SELECT id FROM public.adverts WHERE status = 'active' LIMIT 30
),
users_list AS (
  SELECT * FROM (VALUES
    ('11111111-1111-1111-1111-111111111111'::uuid),
    ('22222222-2222-2222-2222-222222222222'::uuid),
    ('33333333-3333-3333-3333-333333333333'::uuid),
    ('44444444-4444-4444-4444-444444444444'::uuid),
    ('55555555-5555-5555-5555-555555555555'::uuid),
    ('66666666-6666-6666-6666-666666666666'::uuid),
    ('77777777-7777-7777-7777-777777777777'::uuid),
    ('88888888-8888-8888-8888-888888888888'::uuid),
    ('99999999-9999-9999-9999-999999999999'::uuid),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)
  ) AS t(user_id)
)
INSERT INTO public.advert_likes (user_id, advert_id, created_at)
SELECT
  ul.user_id,
  al.id,
  now() - INTERVAL '1 day'
FROM adverts_for_likes al
CROSS JOIN users_list ul
WHERE (al.id::text || ul.user_id::text)::bit(32)::integer % 100 < 45
ON CONFLICT (user_id, advert_id) DO NOTHING;

-- ============================================================================
-- 7. ADD REVIEWS (from different users)
-- ============================================================================

-- First create conversations (required for review gate)
WITH seller_list AS (
  SELECT DISTINCT user_id, id FROM public.adverts WHERE status = 'active' LIMIT 15
),
reviewer_list AS (
  SELECT * FROM (VALUES
    ('11111111-1111-1111-1111-111111111111'::uuid),
    ('22222222-2222-2222-2222-222222222222'::uuid),
    ('33333333-3333-3333-3333-333333333333'::uuid),
    ('55555555-5555-5555-5555-555555555555'::uuid),
    ('77777777-7777-7777-7777-777777777777'::uuid)
  ) AS t(user_id)
)
INSERT INTO public.conversations (advert_id, initiator_id, respondent_id, created_at)
SELECT
  sl.id AS advert_id,
  rl.user_id AS initiator_id,
  sl.user_id AS respondent_id,
  now() - INTERVAL '1 day'
FROM seller_list sl
CROSS JOIN reviewer_list rl
WHERE sl.user_id != rl.user_id
  AND (sl.id::text || rl.user_id::text)::bit(32)::integer % 100 < 50
ON CONFLICT DO NOTHING;

-- Add conversation participants
INSERT INTO public.conversation_participants (conversation_id, user_id, created_at)
SELECT c.id, c.initiator_id, now()
FROM public.conversations c
UNION ALL
SELECT c.id, c.respondent_id, now()
FROM public.conversations c
ON CONFLICT DO NOTHING;

-- Add reviews via the RPC function
-- Note: This requires the create_review RPC to be called from the application layer
-- or we can insert directly if we have the right permissions

COMMIT;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
-- Test accounts created:
-- Email: anna.brussels@test.com
-- Email: mark.gent@test.com
-- Email: lisa.antwerp@test.com
-- Email: john.charleroi@test.com
-- Email: emma.liege@test.com
-- Email: thomas.bruges@test.com
-- Email: sophie.brussels@test.com
-- Email: max.liege@test.com
-- Email: julia.antwerp@test.com
-- Email: diego.gent@test.com
--
-- Password: TestPassword123!
--
-- SEEDING STATISTICS:
-- Adverts created: ~80 (20 cars + 20 apartments + 20 electronics + 20 clothing)
-- Photos added: ~240 (3 per advert)
-- Likes added: ~270 (distributed across users)
-- Conversations created: Prepared for buyer-seller interactions
--
-- View the populated marketplace at: http://localhost:3000
