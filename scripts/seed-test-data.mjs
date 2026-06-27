#!/usr/bin/env node

/**
 * Seed test data: realistic adverts, users, likes, reviews, media
 * Creates multiple test accounts and populates marketplace with sample listings
 *
 * Usage: node scripts/seed-test-data.mjs [--category-filter=transport] [--count=5]
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kjzqowcxojspjtoadzee.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// ============================================================================
// TEST DATA GENERATORS
// ============================================================================

const CATEGORIES_WITH_SAMPLES = {
  'cars-used': [
    { title: 'BMW 3 Series 2015 • 125,000 km • Отличное состояние', price: 12500, condition: 'excellent' },
    { title: 'Mercedes C-Class 2014 • 98,000 км • Немецкий сервис', price: 14000, condition: 'excellent' },
    { title: 'VW Golf 2013 • 156,000 км • Надежный семейный автомобиль', price: 7500, condition: 'good' },
    { title: 'Audi A4 2016 • 87,000 км • Технически исправен', price: 15500, condition: 'excellent' },
    { title: 'Ford Focus 2012 • 201,000 км • Дешево, переоборудование', price: 4200, condition: 'fair' },
    { title: 'Toyota Corolla 2011 • 189,000 км • Самая надежная', price: 6800, condition: 'good' },
    { title: 'Renault Megane 2014 • 145,000 км • Новые тормоза и диски', price: 5900, condition: 'good' },
    { title: 'Skoda Octavia 2015 • 112,000 км • Проверена на СТО', price: 8500, condition: 'excellent' },
    { title: 'Hyundai ix35 2013 • 178,000 км • Внедорожник, полный привод', price: 9200, condition: 'good' },
    { title: 'Peugeot 308 2012 • 167,000 км • Европейский автомобиль', price: 5500, condition: 'fair' },
  ],
  'apartment-rent': [
    { title: 'Уютная студия в центре • WiFi • Меблирована', price: 850, condition: 'new' },
    { title: '2 комнаты • Метро Porte de Hal • Балкон с видом', price: 1200, condition: 'good' },
    { title: 'Большая квартира • 120м² • Три спальни • Парковка', price: 1800, condition: 'excellent' },
    { title: 'Студия с кухней • Брюссель центр • Все включено', price: 950, condition: 'new' },
    { title: '1 комната в общей квартире • Молодежное общежитие', price: 650, condition: 'good' },
    { title: 'Люкс апартамент • Панорамный вид • Охрана', price: 2500, condition: 'excellent' },
    { title: 'Компактная квартира • Хороший ремонт • Свежий воздух', price: 1100, condition: 'excellent' },
    { title: 'Классика • 2 спальни • Душ и ванна • Столовая', price: 1350, condition: 'good' },
    { title: 'Студио рядом с парком • Естественный свет • Зеленый двор', price: 900, condition: 'good' },
    { title: 'Большая площадь • 4 комнаты • Для семьи • Стиральная машина', price: 1650, condition: 'excellent' },
  ],
  'real-estate-sale': [
    { title: 'Дом • 180м² • 4 спальни • Участок 500м² • Гаражи', price: 425000, condition: 'good' },
    { title: 'Шикарная вилла • 350м² • Панорамный вид • Бассейн', price: 850000, condition: 'excellent' },
    { title: 'Таунхаус • 3 этажа • 200м² • Терраса • Тихое место', price: 385000, condition: 'excellent' },
    { title: 'Инвестиционная недвижимость • 6 апартаментов • Доход', price: 650000, condition: 'good' },
    { title: 'Уютный домик • 140м² • Сад • Рядом лес • Спокойно', price: 298000, condition: 'fair' },
    { title: 'Современная квартира • Пентхаус • 250м² • 3 спальни', price: 725000, condition: 'excellent' },
    { title: 'Земельный участок • 2000м² • Под застройку • Коммуникации', price: 175000, condition: 'new' },
    { title: 'Коммерческое помещение • 400м² • Офис + склад • Парковка', price: 520000, condition: 'good' },
    { title: 'Реновированный дом • 190м² • 5 спален • Все современное', price: 520000, condition: 'excellent' },
    { title: 'Участок в коттеджном поселке • Закрытая территория', price: 245000, condition: 'new' },
  ],
  'clothing-women': [
    { title: 'Пальто зимнее • Размер M • Шерсть • Как новое', price: 45, condition: 'excellent' },
    { title: 'Платье вечернее • Размер 38 • Дизайнерское • Редкое', price: 120, condition: 'excellent' },
    { title: 'Джинсы • Размер 26 • Бренд Levi\'s • Темно-синие', price: 25, condition: 'good' },
    { title: 'Кожаная куртка • Размер S • Черная • Натуральная кожа', price: 65, condition: 'excellent' },
    { title: 'Пляжное платье • Размер M • Летнее • Яркое', price: 15, condition: 'like new' },
    { title: 'Блузка шелковая • Размер 36 • Нейтральный цвет', price: 30, condition: 'excellent' },
    { title: 'Юбка плиссе • Размер 40 • Классика • Черная', price: 35, condition: 'excellent' },
    { title: 'Кардиган шерстяной • Размер L • Уютный • Бежевый', price: 40, condition: 'good' },
    { title: 'Спортивный костюм • Размер M • Adidas • Оригинал', price: 50, condition: 'excellent' },
    { title: 'Туника льняная • Размер M-L • Летняя • Белая', price: 20, condition: 'excellent' },
  ],
  'electronics': [
    { title: 'iPhone 13 Pro • 256GB • Space Gray • Идеал состояние', price: 650, condition: 'excellent' },
    { title: 'MacBook Pro 2020 • i7 • 16GB RAM • SSD 512GB', price: 1200, condition: 'excellent' },
    { title: 'Samsung Galaxy S22 • 128GB • Phantom White • Чехол в подарок', price: 450, condition: 'excellent' },
    { title: 'iPad Pro 12.9" • 256GB • Wi-Fi + Cellular • Карандаш Apple', price: 800, condition: 'excellent' },
    { title: 'Sony WH-1000XM5 • Наушники • Черные • С кейсом', price: 280, condition: 'excellent' },
    { title: 'DJI Air 2S • Дрон • Все аксессуары • Как новый', price: 950, condition: 'excellent' },
    { title: 'Nintendo Switch OLED • 64GB • Две игры • Защиты', price: 320, condition: 'excellent' },
    { title: 'Ноутбук Dell XPS 13 • i9 • 16GB • 1TB SSD • FHD', price: 850, condition: 'good' },
    { title: 'Смарт-часы Apple Watch Series 8 • 45mm • Спортивный ремешок', price: 350, condition: 'excellent' },
    { title: 'Монитор LG 27" 4K UHD • USB-C • Как новый • Гарантия', price: 420, condition: 'excellent' },
  ],
  'furniture': [
    { title: 'Диван • 3-местный • Темно-серый • Комфортный', price: 450, condition: 'good' },
    { title: 'Стол обеденный • Деревянный • 6 мест • Классический дизайн', price: 320, condition: 'excellent' },
    { title: 'Кровать двуспальная • Кожа • Высокие спинки • Стильная', price: 550, condition: 'excellent' },
    { title: 'Шкаф встроенный • Зеркало • Множество полок • Светлое дерево', price: 380, condition: 'good' },
    { title: 'Кресло офисное • Эргономичное • Черное • Как новое', price: 180, condition: 'excellent' },
    { title: 'Книжный шкаф • Металл + дерево • Лофт стиль • Компактный', price: 140, condition: 'excellent' },
    { title: 'Столик журнальный • Стекло + металл • Современный', price: 95, condition: 'excellent' },
    { title: 'Комод • 4 ящика • Темное дерево • Классика', price: 220, condition: 'good' },
    { title: 'Тумба ТВ • 150см • Светлое дерево • Много места для хранения', price: 280, condition: 'excellent' },
    { title: 'Диван угловой • Трансформер • Ортопедический матрас', price: 650, condition: 'excellent' },
  ],
  'sports': [
    { title: 'Велосипед горный • Trek • 27.5" • Алюминий • Как новый', price: 420, condition: 'excellent' },
    { title: 'Скейтборд • Tony Hawk Pro • Профессиональный • Полный комплект', price: 85, condition: 'excellent' },
    { title: 'Теннисная ракетка • Wilson Pro • Карбон • С чехлом', price: 95, condition: 'excellent' },
    { title: 'Беговая дорожка • NordicTrack • Электрическая • Программы', price: 350, condition: 'good' },
    { title: 'Велотренажер статический • Stationary • Для фитнеса', price: 280, condition: 'excellent' },
    { title: 'Горные лыжи • Salomon • 170см • Крепления • Ботинки', price: 280, condition: 'good' },
    { title: 'Сноуборд • Burton • 155см • Как новый • Крепления', price: 250, condition: 'excellent' },
    { title: 'Прошивка гантели • 20-50 кг • Композит • Регулируемые', price: 420, condition: 'excellent' },
    { title: 'Боксерский мешок • 100кг • Цепь • Перчатки • Все есть', price: 150, condition: 'excellent' },
    { title: 'Скутер электрический • Xiaomi Pro • 45км/ч • Батарея 80%', price: 380, condition: 'good' },
  ],
};

const TEST_USERS = [
  { email: 'anna.brussels@test.com', name: 'Анна из Брюсселя', phone: '+32487123456', verified: true },
  { email: 'mark.gent@test.com', name: 'Марк из Гента', phone: '+32498765432', verified: true },
  { email: 'lisa.antwerp@test.com', name: 'Лиза из Антверпена', phone: '+32470555666', verified: true },
  { email: 'john.charleroi@test.com', name: 'Джон из Шарлеруа', phone: '+32491234567', verified: false },
  { email: 'emma.liege@test.com', name: 'Эмма из Льежа', phone: '+32476789012', verified: true },
  { email: 'thomas.bruges@test.com', name: 'Томас из Брюгге', phone: '+32481234567', verified: true },
  { email: 'sophie.brussels@test.com', name: 'Софи из Брюсселя', phone: '+32486543210', verified: false },
  { email: 'max.liege@test.com', name: 'Макс из Льежа', phone: '+32479876543', verified: true },
  { email: 'julia.antwerp@test.com', name: 'Юлия из Антверпена', phone: '+32488888888', verified: true },
  { email: 'diego.gent@test.com', name: 'Диего из Гента', phone: '+32477777777', verified: true },
];

const LOCATIONS = [
  { country: 'Belgium', region: 'Brussels', city: 'Brussels', postcode: '1000' },
  { country: 'Belgium', region: 'Flanders', city: 'Gent', postcode: '9000' },
  { country: 'Belgium', region: 'Flanders', city: 'Antwerp', postcode: '2000' },
  { country: 'Belgium', region: 'Wallonia', city: 'Charleroi', postcode: '6000' },
  { country: 'Belgium', region: 'Wallonia', city: 'Liège', postcode: '4000' },
  { country: 'Belgium', region: 'Flanders', city: 'Bruges', postcode: '8000' },
  { country: 'Belgium', region: 'Brussels', city: 'Brussels', postcode: '1020' },
  { country: 'Belgium', region: 'Flanders', city: 'Leuven', postcode: '3000' },
];

const PHOTO_URLS = [
  'https://images.unsplash.com/photo-1552820728-8ac41f1ce891?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1493857671505-72967e2e2760?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1580489944761-b60bbb8d0edc?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1469022563149-aa64dbd37dba?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1552820728-8ac41f1ce891?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1523217311519-3f69fba0b80b?w=400&h=300&fit=crop',
];

// ============================================================================
// MAIN SEEDING LOGIC
// ============================================================================

async function seedTestData() {
  console.log('🌱 Starting test data seeding...');
  console.log(`📊 Will create ${TEST_USERS.length} test users`);

  try {
    // 1. Create test users
    const users = await createTestUsers();
    console.log(`✅ Created ${users.length} test users`);

    // 2. Get all categories
    const categories = await getCategories();
    console.log(`📁 Found ${categories.length} categories`);

    // 3. Create adverts for selected categories
    let advertCount = 0;
    for (const category of categories) {
      const samples = CATEGORIES_WITH_SAMPLES[category.slug];
      if (!samples) continue;

      console.log(`\n📢 Creating adverts for: ${category.name_ru}...`);

      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];
        const advertUser = users[i % users.length]; // Round-robin users
        const location = LOCATIONS[i % LOCATIONS.length];

        try {
          const advert = await createAdvert(
            advertUser.id,
            category.id,
            sample.title,
            sample.price,
            location,
            sample.condition
          );

          // Add 2-4 photos per advert
          const photoCount = 2 + Math.floor(Math.random() * 3);
          for (let p = 0; p < photoCount; p++) {
            const photoUrl = PHOTO_URLS[(advertCount + p) % PHOTO_URLS.length];
            await addMediaToAdvert(advert.id, photoUrl, p);
          }

          advertCount++;
        } catch (err) {
          console.error(`   ❌ Failed to create advert: ${err.message}`);
        }
      }
    }

    console.log(`\n✅ Created ${advertCount} adverts with media`);

    // 4. Add likes (users like random adverts)
    const { data: allAdverts } = await supabase
      .from('adverts')
      .select('id')
      .limit(100);

    if (allAdverts && allAdverts.length > 0) {
      let likeCount = 0;
      for (const advert of allAdverts.slice(0, Math.min(50, allAdverts.length))) {
        // Random 2-5 likes per advert
        const likeCount_ = 2 + Math.floor(Math.random() * 4);
        const userSubset = users.sort(() => 0.5 - Math.random()).slice(0, likeCount_);

        for (const user of userSubset) {
          try {
            await addLike(user.id, advert.id);
            likeCount++;
          } catch (err) {
            // Duplicate like is ok
          }
        }
      }
      console.log(`👍 Added ${likeCount} likes`);
    }

    // 5. Add reviews
    let reviewCount = 0;
    if (allAdverts && allAdverts.length > 0) {
      for (const advert of allAdverts.slice(0, Math.min(20, allAdverts.length))) {
        const reviewerIdx = Math.floor(Math.random() * users.length);
        const reviewer = users[reviewerIdx];

        // Get advert owner
        const { data: advertData } = await supabase
          .from('adverts')
          .select('user_id')
          .eq('id', advert.id)
          .single();

        if (advertData && advertData.user_id !== reviewer.id) {
          try {
            // Create conversation first (required for review gate)
            const convId = randomUUID();
            await supabase.from('conversations').insert({
              id: convId,
              advert_id: advert.id,
              initiator_id: reviewer.id,
              respondent_id: advertData.user_id,
            });

            // Add participants
            await supabase.from('conversation_participants').insert([
              { conversation_id: convId, user_id: reviewer.id },
              { conversation_id: convId, user_id: advertData.user_id },
            ]);

            // Create review
            const rating = 3 + Math.floor(Math.random() * 3); // 3-5 stars
            const comments = [
              'Отличный товар, быстрая доставка!',
              'Соответствует описанию, спасибо!',
              'Хороший продавец, рекомендую!',
              'Все прошло гладко, спасибо за помощь',
              'Точно как на фото, очень доволен',
            ];
            const comment = comments[Math.floor(Math.random() * comments.length)];

            await supabase.rpc('create_review', {
              p_advert_id: advert.id,
              p_rating: rating,
              p_comment: comment,
            });

            reviewCount++;
          } catch (err) {
            // Review might already exist or conversation, that's ok
          }
        }
      }
      console.log(`⭐ Added ${reviewCount} reviews`);
    }

    console.log('\n✨ Seeding complete!');
    console.log(`
Summary:
- 👥 Test users: ${users.length}
- 📢 Adverts: ${advertCount}
- 📸 Media items: ${advertCount * 3} (avg 3 per advert)
- 👍 Likes: ${Math.min(likeCount, 50 * 4)} (2-5 per advert)
- ⭐ Reviews: ${reviewCount}

Test account credentials:
${TEST_USERS.map((u) => `  ${u.email}`).join('\n')}

Password for all accounts: TestPassword123!
    `);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function createTestUsers() {
  const createdUsers = [];

  for (const testUser of TEST_USERS) {
    try {
      // Create auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: testUser.email,
        password: 'TestPassword123!',
        email_confirm: true,
        user_metadata: { display_name: testUser.name },
      });

      if (authError) {
        // User might already exist
        const { data: existingUser } = await supabase.auth.admin.listUsers();
        const found = existingUser?.users?.find((u) => u.email === testUser.email);
        if (found) {
          console.log(`  ℹ️  User already exists: ${testUser.email}`);
          createdUsers.push(found);
          continue;
        }
        throw authError;
      }

      // Create profile
      await supabase.from('profiles').insert({
        id: authUser.user.id,
        display_name: testUser.name,
        verified_email: testUser.verified,
        verified_phone: testUser.verified,
      });

      // Add phone
      await supabase.from('phones').insert({
        user_id: authUser.user.id,
        e164: testUser.phone,
        verified: testUser.verified,
      });

      createdUsers.push(authUser.user);
      console.log(`  ✅ ${testUser.email}`);
    } catch (err) {
      console.error(`  ⚠️  Failed to create ${testUser.email}: ${err.message}`);
    }
  }

  return createdUsers;
}

async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('level', 3)
    .eq('is_active', true);

  if (error) throw error;
  return data || [];
}

async function createAdvert(userId, categoryId, title, price, location, condition) {
  const description = `
${title}

✨ Основные характеристики:
• Состояние: ${condition === 'excellent' ? 'Отличное' : condition === 'good' ? 'Хорошее' : 'Удовлетворительное'}
• Цена: €${price}
• Готово к использованию
• Быстрая обработка

📍 Локация: ${location.city}, ${location.postcode}

💬 Свяжитесь со мной для подробнее информации!
  `.trim();

  const { data, error } = await supabase
    .from('adverts')
    .insert({
      user_id: userId,
      category_id: categoryId,
      title,
      description,
      price,
      currency: 'EUR',
      condition,
      location: `${location.city}, ${location.postcode}`,
      status: 'active',
      moderation_status: 'approved',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function addMediaToAdvert(advertId, url, sortOrder) {
  const { error } = await supabase.from('media').insert({
    advert_id: advertId,
    url,
    sort: sortOrder,
  });

  if (error) throw error;
}

async function addLike(userId, advertId) {
  const { error } = await supabase.from('advert_likes').insert({
    user_id: userId,
    advert_id: advertId,
  });

  if (error) throw error;
}

// ============================================================================
// EXECUTE
// ============================================================================

seedTestData();
