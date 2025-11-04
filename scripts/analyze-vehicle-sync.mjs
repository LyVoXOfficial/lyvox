#!/usr/bin/env node
/**
 * Анализ синхронизации данных между vehicles_full_enriched2.json и БД
 * 
 * Что проверяется:
 * 1. Количество марок/моделей в JSON vs БД
 * 2. Пропущенные марки/модели (есть в JSON, нет в БД)
 * 3. Фильтр по годам >= 1980
 * 4. Статистика по переводам
 * 
 * Использование:
 *   DATABASE_URL=... node scripts/analyze-vehicle-sync.mjs
 */

import { readFile } from 'node:fs/promises';
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
// Helper functions
// ==========================

function createSlug(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Проверяет, подходит ли модель по фильтру >= 1980
 */
function isModelValid(model) {
  if (!model) return false;
  
  // Проверяем first_model_year
  if (model.first_model_year && model.first_model_year >= 1980) return true;
  
  // Проверяем years_available
  if (Array.isArray(model.years_available) && model.years_available.length > 0) {
    const maxYear = Math.max(...model.years_available);
    if (maxYear >= 1980) return true;
  }
  
  return false;
}

// ==========================
// Анализ JSON
// ==========================

async function analyzeJSON() {
  console.log('📄 Анализ vehicles_full_enriched2.json...\n');
  
  const raw = await readFile('./seed/vehicles_full_enriched2.json', 'utf8');
  const data = JSON.parse(raw);
  
  const stats = {
    totalMakes: data.makes.length,
    totalModels: 0,
    totalGenerations: 0,
    validMakes: 0,        // марки с хотя бы 1 моделью >= 1980
    validModels: 0,       // модели >= 1980
    validGenerations: 0,  // поколения для валидных моделей
    makesBySlug: new Map(),  // slug -> make data
    modelsBySlug: new Map(), // make_slug::model_slug -> model data
  };
  
  for (const make of data.makes) {
    const makeSlug = createSlug(make.slug || make.name_en);
    const validModels = [];
    
    if (Array.isArray(make.models)) {
      for (const model of make.models) {
        stats.totalModels++;
        
        if (isModelValid(model)) {
          stats.validModels++;
          const modelSlug = createSlug(model.slug || model.name_en);
          const modelKey = `${makeSlug}::${modelSlug}`;
          
          validModels.push(model);
          stats.modelsBySlug.set(modelKey, {
            make: make.name_en,
            model: model.name_en,
            first_year: model.first_model_year,
            last_year: model.last_model_year,
            years: model.years_available,
            has_insight: !!model.insight,
          });
          
          if (Array.isArray(model.generations)) {
            stats.totalGenerations += model.generations.length;
            stats.validGenerations += model.generations.length;
          }
        }
      }
    }
    
    if (validModels.length > 0) {
      stats.validMakes++;
      stats.makesBySlug.set(makeSlug, {
        name: make.name_en,
        country: make.country,
        modelsCount: validModels.length,
      });
    }
  }
  
  console.log('📊 Статистика JSON (всего):');
  console.log(`   Марок: ${stats.totalMakes}`);
  console.log(`   Моделей: ${stats.totalModels}`);
  console.log(`   Поколений: ${stats.totalGenerations}`);
  console.log();
  console.log('📊 Статистика JSON (>= 1980):');
  console.log(`   ✅ Марок: ${stats.validMakes}`);
  console.log(`   ✅ Моделей: ${stats.validModels}`);
  console.log(`   ✅ Поколений: ${stats.validGenerations}`);
  console.log();
  
  return stats;
}

// ==========================
// Анализ БД
// ==========================

async function analyzeDB() {
  console.log('🗄️  Анализ базы данных...\n');
  
  await client.connect();
  
  // Марки
  const makesResult = await client.query(`
    SELECT slug, name_en, country 
    FROM public.vehicle_makes 
    WHERE is_active = true
  `);
  
  // Модели
  const modelsResult = await client.query(`
    SELECT 
      vm.slug as model_slug, 
      vm.name_en as model_name,
      vm.first_model_year,
      vm.last_model_year,
      vma.slug as make_slug,
      vma.name_en as make_name
    FROM public.vehicle_models vm
    JOIN public.vehicle_makes vma ON vma.id = vm.make_id
    WHERE vma.is_active = true
  `);
  
  // Поколения
  const generationsResult = await client.query(`
    SELECT COUNT(*) as count 
    FROM public.vehicle_generations
  `);
  
  // Insights
  const insightsResult = await client.query(`
    SELECT COUNT(*) as count 
    FROM public.vehicle_insights
  `);
  
  // Переводы
  const i18nMakesResult = await client.query(`
    SELECT locale, COUNT(*) as count 
    FROM public.vehicle_make_i18n 
    GROUP BY locale
  `);
  
  const i18nModelsResult = await client.query(`
    SELECT locale, COUNT(*) as count 
    FROM public.vehicle_model_i18n 
    GROUP BY locale
  `);
  
  const i18nGenResult = await client.query(`
    SELECT locale, COUNT(*) as count 
    FROM public.vehicle_generation_i18n 
    GROUP BY locale
  `);
  
  const dbStats = {
    makesCount: makesResult.rows.length,
    modelsCount: modelsResult.rows.length,
    generationsCount: parseInt(generationsResult.rows[0].count, 10),
    insightsCount: parseInt(insightsResult.rows[0].count, 10),
    makesBySlug: new Map(),
    modelsBySlug: new Map(),
    i18n: {
      makes: {},
      models: {},
      generations: {},
    },
  };
  
  // Заполняем maps
  for (const row of makesResult.rows) {
    dbStats.makesBySlug.set(row.slug, {
      name: row.name_en,
      country: row.country,
    });
  }
  
  for (const row of modelsResult.rows) {
    const key = `${row.make_slug}::${row.model_slug}`;
    dbStats.modelsBySlug.set(key, {
      make: row.make_name,
      model: row.model_name,
      first_year: row.first_model_year,
      last_year: row.last_model_year,
    });
  }
  
  // i18n stats
  for (const row of i18nMakesResult.rows) {
    dbStats.i18n.makes[row.locale] = parseInt(row.count, 10);
  }
  for (const row of i18nModelsResult.rows) {
    dbStats.i18n.models[row.locale] = parseInt(row.count, 10);
  }
  for (const row of i18nGenResult.rows) {
    dbStats.i18n.generations[row.locale] = parseInt(row.count, 10);
  }
  
  console.log('📊 Статистика БД:');
  console.log(`   Марок: ${dbStats.makesCount}`);
  console.log(`   Моделей: ${dbStats.modelsCount}`);
  console.log(`   Поколений: ${dbStats.generationsCount}`);
  console.log(`   Insights: ${dbStats.insightsCount}`);
  console.log();
  console.log('📊 Переводы марок:');
  for (const [locale, count] of Object.entries(dbStats.i18n.makes)) {
    console.log(`   ${locale}: ${count}`);
  }
  console.log();
  console.log('📊 Переводы моделей:');
  for (const [locale, count] of Object.entries(dbStats.i18n.models)) {
    console.log(`   ${locale}: ${count}`);
  }
  console.log();
  console.log('📊 Переводы поколений:');
  for (const [locale, count] of Object.entries(dbStats.i18n.generations)) {
    console.log(`   ${locale}: ${count}`);
  }
  console.log();
  
  return dbStats;
}

// ==========================
// Сравнение и вывод отчета
// ==========================

async function compareAndReport(jsonStats, dbStats) {
  console.log('🔍 Сравнение JSON и БД...\n');
  
  // Пропущенные марки
  const missingMakes = [];
  for (const [slug, makeData] of jsonStats.makesBySlug) {
    if (!dbStats.makesBySlug.has(slug)) {
      missingMakes.push({ slug, ...makeData });
    }
  }
  
  // Пропущенные модели
  const missingModels = [];
  for (const [key, modelData] of jsonStats.modelsBySlug) {
    if (!dbStats.modelsBySlug.has(key)) {
      missingModels.push({ key, ...modelData });
    }
  }
  
  console.log('❌ Пропущенные марки (есть в JSON >= 1980, нет в БД):');
  if (missingMakes.length === 0) {
    console.log('   ✅ Все марки загружены!');
  } else {
    console.log(`   Всего: ${missingMakes.length}`);
    missingMakes.slice(0, 20).forEach(m => {
      console.log(`   - ${m.slug} (${m.name}), моделей: ${m.modelsCount}`);
    });
    if (missingMakes.length > 20) {
      console.log(`   ... и ещё ${missingMakes.length - 20}`);
    }
  }
  console.log();
  
  console.log('❌ Пропущенные модели (есть в JSON >= 1980, нет в БД):');
  if (missingModels.length === 0) {
    console.log('   ✅ Все модели загружены!');
  } else {
    console.log(`   Всего: ${missingModels.length}`);
    missingModels.slice(0, 30).forEach(m => {
      console.log(`   - ${m.key} (${m.make} ${m.model}), годы: ${m.first_year}-${m.last_year}`);
    });
    if (missingModels.length > 30) {
      console.log(`   ... и ещё ${missingModels.length - 30}`);
    }
  }
  console.log();
  
  // Итоговый отчет
  console.log('═══════════════════════════════════════════════');
  console.log('📈 ИТОГОВЫЙ ОТЧЕТ');
  console.log('═══════════════════════════════════════════════');
  console.log();
  console.log('JSON (>= 1980):');
  console.log(`  Марок:     ${jsonStats.validMakes}`);
  console.log(`  Моделей:   ${jsonStats.validModels}`);
  console.log(`  Поколений: ${jsonStats.validGenerations}`);
  console.log();
  console.log('База данных:');
  console.log(`  Марок:     ${dbStats.makesCount}`);
  console.log(`  Моделей:   ${dbStats.modelsCount}`);
  console.log(`  Поколений: ${dbStats.generationsCount}`);
  console.log(`  Insights:  ${dbStats.insightsCount}`);
  console.log();
  console.log('Разница:');
  console.log(`  Марок не хватает:    ${missingMakes.length}`);
  console.log(`  Моделей не хватает:  ${missingModels.length}`);
  console.log();
  
  const coverage = {
    makes: ((dbStats.makesCount / jsonStats.validMakes) * 100).toFixed(1),
    models: ((dbStats.modelsCount / jsonStats.validModels) * 100).toFixed(1),
  };
  
  console.log('📊 Покрытие:');
  console.log(`  Марки:   ${coverage.makes}%`);
  console.log(`  Модели:  ${coverage.models}%`);
  console.log();
  
  if (missingMakes.length === 0 && missingModels.length === 0) {
    console.log('✅ База данных полностью синхронизирована с JSON!');
  } else {
    console.log('⚠️  Требуется дополнительная загрузка данных');
  }
  console.log('═══════════════════════════════════════════════');
  
  return { missingMakes, missingModels };
}

// ==========================
// Main
// ==========================

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('🚗 АНАЛИЗ СИНХРОНИЗАЦИИ VEHICLES');
  console.log('═══════════════════════════════════════════════');
  console.log();
  
  try {
    const jsonStats = await analyzeJSON();
    const dbStats = await analyzeDB();
    const { missingMakes, missingModels } = await compareAndReport(jsonStats, dbStats);
    
    // Сохраняем результаты для следующих шагов
    process.exitCode = (missingMakes.length > 0 || missingModels.length > 0) ? 1 : 0;
    
  } catch (err) {
    console.error('❌ Ошибка:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

