#!/usr/bin/env node
/**
 * Проверка дубликатов в таблицах vehicle_makes и vehicle_models
 * 
 * Проверяется:
 * 1. Дубликаты по slug в vehicle_makes
 * 2. Дубликаты по (make_id, slug) в vehicle_models
 * 3. Дубликаты по name_en (похожие названия)
 * 4. Дубликаты в vehicle_generations
 * 
 * Использование:
 *   DATABASE_URL=... node scripts/check-vehicle-duplicates.mjs
 */

import { Client } from 'pg';

const DB_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!DB_URL) {
  console.error('❌ DATABASE_URL or SUPABASE_DB_URL is required');
  process.exit(1);
}

const clientConfig = { connectionString: DB_URL };
if (process.env.PGSSL_REJECT_UNAUTHORIZED === 'false') {
  clientConfig.ssl = { rejectUnauthorized: false };
} else if (process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false') {
  clientConfig.ssl = { rejectUnauthorized: true };
}

const client = new Client(clientConfig);

// ==========================
// Проверка дубликатов марок
// ==========================

async function checkMakesDuplicates() {
  console.log('🔍 Проверка дубликатов марок...\n');
  
  // Проверка по slug
  const slugDuplicates = await client.query(`
    SELECT slug, COUNT(*) as count, array_agg(id) as ids, array_agg(name_en) as names
    FROM public.vehicle_makes
    GROUP BY slug
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `);
  
  console.log('📌 Дубликаты по slug:');
  if (slugDuplicates.rows.length === 0) {
    console.log('   ✅ Дубликатов по slug не найдено');
  } else {
    console.log(`   ❌ Найдено ${slugDuplicates.rows.length} дубликатов:`);
    slugDuplicates.rows.forEach(row => {
      console.log(`   - slug: "${row.slug}", count: ${row.count}`);
      console.log(`     names: ${row.names.join(', ')}`);
      console.log(`     ids: ${row.ids.slice(0, 3).join(', ')}...`);
    });
  }
  console.log();
  
  // Проверка похожих name_en (регистронезависимо)
  const nameDuplicates = await client.query(`
    SELECT LOWER(name_en) as lower_name, COUNT(*) as count, 
           array_agg(slug) as slugs, array_agg(name_en) as names
    FROM public.vehicle_makes
    GROUP BY LOWER(name_en)
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `);
  
  console.log('📌 Дубликаты по name_en (case-insensitive):');
  if (nameDuplicates.rows.length === 0) {
    console.log('   ✅ Дубликатов по имени не найдено');
  } else {
    console.log(`   ⚠️  Найдено ${nameDuplicates.rows.length} совпадений:`);
    nameDuplicates.rows.forEach(row => {
      console.log(`   - name: "${row.lower_name}", count: ${row.count}`);
      console.log(`     slugs: ${row.slugs.join(', ')}`);
    });
  }
  console.log();
  
  return {
    slugDuplicates: slugDuplicates.rows.length,
    nameDuplicates: nameDuplicates.rows.length,
  };
}

// ==========================
// Проверка дубликатов моделей
// ==========================

async function checkModelsDuplicates() {
  console.log('🔍 Проверка дубликатов моделей...\n');
  
  // Проверка по (make_id, slug)
  const slugDuplicates = await client.query(`
    SELECT vm.make_id, vm.slug, COUNT(*) as count, 
           array_agg(vm.id) as ids, 
           array_agg(vm.name_en) as names,
           vma.slug as make_slug,
           vma.name_en as make_name
    FROM public.vehicle_models vm
    JOIN public.vehicle_makes vma ON vma.id = vm.make_id
    GROUP BY vm.make_id, vm.slug, vma.slug, vma.name_en
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `);
  
  console.log('📌 Дубликаты по (make_id, slug):');
  if (slugDuplicates.rows.length === 0) {
    console.log('   ✅ Дубликатов не найдено');
  } else {
    console.log(`   ❌ Найдено ${slugDuplicates.rows.length} дубликатов:`);
    slugDuplicates.rows.forEach(row => {
      console.log(`   - make: ${row.make_slug}, model_slug: "${row.slug}", count: ${row.count}`);
      console.log(`     names: ${row.names.join(', ')}`);
      console.log(`     ids: ${row.ids.slice(0, 3).join(', ')}...`);
    });
  }
  console.log();
  
  // Проверка похожих имён в рамках одной марки
  const nameDuplicates = await client.query(`
    SELECT vm.make_id, LOWER(vm.name_en) as lower_name, COUNT(*) as count,
           array_agg(vm.slug) as slugs,
           array_agg(vm.name_en) as names,
           vma.slug as make_slug
    FROM public.vehicle_models vm
    JOIN public.vehicle_makes vma ON vma.id = vm.make_id
    GROUP BY vm.make_id, LOWER(vm.name_en), vma.slug
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `);
  
  console.log('📌 Дубликаты по name_en в рамках марки (case-insensitive):');
  if (nameDuplicates.rows.length === 0) {
    console.log('   ✅ Дубликатов не найдено');
  } else {
    console.log(`   ⚠️  Найдено ${nameDuplicates.rows.length} совпадений:`);
    nameDuplicates.rows.forEach(row => {
      console.log(`   - make: ${row.make_slug}, name: "${row.lower_name}", count: ${row.count}`);
      console.log(`     slugs: ${row.slugs.join(', ')}`);
    });
  }
  console.log();
  
  return {
    slugDuplicates: slugDuplicates.rows.length,
    nameDuplicates: nameDuplicates.rows.length,
  };
}

// ==========================
// Проверка дубликатов поколений
// ==========================

async function checkGenerationsDuplicates() {
  console.log('🔍 Проверка дубликатов поколений...\n');
  
  const duplicates = await client.query(`
    SELECT vg.model_id, vg.code, COUNT(*) as count,
           array_agg(vg.id) as ids,
           vm.slug as model_slug,
           vma.slug as make_slug
    FROM public.vehicle_generations vg
    JOIN public.vehicle_models vm ON vm.id = vg.model_id
    JOIN public.vehicle_makes vma ON vma.id = vm.make_id
    GROUP BY vg.model_id, vg.code, vm.slug, vma.slug
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `);
  
  console.log('📌 Дубликаты по (model_id, code):');
  if (duplicates.rows.length === 0) {
    console.log('   ✅ Дубликатов не найдено');
  } else {
    console.log(`   ❌ Найдено ${duplicates.rows.length} дубликатов:`);
    duplicates.rows.forEach(row => {
      console.log(`   - ${row.make_slug} ${row.model_slug}, code: "${row.code}", count: ${row.count}`);
      console.log(`     ids: ${row.ids.slice(0, 3).join(', ')}...`);
    });
  }
  console.log();
  
  return {
    duplicates: duplicates.rows.length,
  };
}

// ==========================
// Проверка сирот (orphaned records)
// ==========================

async function checkOrphans() {
  console.log('🔍 Проверка сирот (записей без связей)...\n');
  
  // Модели без марок (не должно быть из-за FK)
  const orphanModels = await client.query(`
    SELECT COUNT(*) as count
    FROM public.vehicle_models vm
    LEFT JOIN public.vehicle_makes vma ON vma.id = vm.make_id
    WHERE vma.id IS NULL
  `);
  
  // Поколения без моделей
  const orphanGenerations = await client.query(`
    SELECT COUNT(*) as count
    FROM public.vehicle_generations vg
    LEFT JOIN public.vehicle_models vm ON vm.id = vg.model_id
    WHERE vm.id IS NULL
  `);
  
  // Insights без моделей
  const orphanInsights = await client.query(`
    SELECT COUNT(*) as count
    FROM public.vehicle_insights vi
    LEFT JOIN public.vehicle_models vm ON vm.id = vi.model_id
    WHERE vm.id IS NULL
  `);
  
  console.log('📌 Сироты (orphaned records):');
  console.log(`   Модели без марок: ${orphanModels.rows[0].count}`);
  console.log(`   Поколения без моделей: ${orphanGenerations.rows[0].count}`);
  console.log(`   Insights без моделей: ${orphanInsights.rows[0].count}`);
  console.log();
  
  const totalOrphans = parseInt(orphanModels.rows[0].count) + 
                       parseInt(orphanGenerations.rows[0].count) + 
                       parseInt(orphanInsights.rows[0].count);
  
  if (totalOrphans === 0) {
    console.log('   ✅ Сирот не найдено');
  } else {
    console.log(`   ⚠️  Всего сирот: ${totalOrphans}`);
  }
  console.log();
  
  return {
    orphanModels: parseInt(orphanModels.rows[0].count),
    orphanGenerations: parseInt(orphanGenerations.rows[0].count),
    orphanInsights: parseInt(orphanInsights.rows[0].count),
  };
}

// ==========================
// Итоговый отчет
// ==========================

function printSummary(makes, models, generations, orphans) {
  console.log('═══════════════════════════════════════════════');
  console.log('📈 ИТОГОВЫЙ ОТЧЕТ');
  console.log('═══════════════════════════════════════════════');
  console.log();
  
  const totalIssues = 
    makes.slugDuplicates + 
    makes.nameDuplicates + 
    models.slugDuplicates + 
    models.nameDuplicates + 
    generations.duplicates +
    orphans.orphanModels +
    orphans.orphanGenerations +
    orphans.orphanInsights;
  
  console.log('Проблемы:');
  console.log(`  Дубликаты марок (slug):       ${makes.slugDuplicates}`);
  console.log(`  Дубликаты марок (name):       ${makes.nameDuplicates}`);
  console.log(`  Дубликаты моделей (slug):     ${models.slugDuplicates}`);
  console.log(`  Дубликаты моделей (name):     ${models.nameDuplicates}`);
  console.log(`  Дубликаты поколений:          ${generations.duplicates}`);
  console.log(`  Сироты (orphaned):            ${orphans.orphanModels + orphans.orphanGenerations + orphans.orphanInsights}`);
  console.log();
  console.log(`Всего проблем: ${totalIssues}`);
  console.log();
  
  if (totalIssues === 0) {
    console.log('✅ База данных в отличном состоянии! Дубликатов и сирот не найдено.');
  } else {
    console.log('⚠️  Обнаружены проблемы. Рекомендуется исправить перед загрузкой новых данных.');
  }
  console.log('═══════════════════════════════════════════════');
  
  return totalIssues;
}

// ==========================
// Main
// ==========================

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('🔍 ПРОВЕРКА ДУБЛИКАТОВ VEHICLES');
  console.log('═══════════════════════════════════════════════');
  console.log();
  
  try {
    await client.connect();
    
    const makes = await checkMakesDuplicates();
    const models = await checkModelsDuplicates();
    const generations = await checkGenerationsDuplicates();
    const orphans = await checkOrphans();
    
    const totalIssues = printSummary(makes, models, generations, orphans);
    
    process.exitCode = totalIssues > 0 ? 1 : 0;
    
  } catch (err) {
    console.error('❌ Ошибка:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

