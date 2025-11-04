#!/usr/bin/env node
/**
 * Полный аудит покрытия данных каталога
 * Генерирует JSON-отчёт о незаполненных полях
 */
import pg from 'pg';
import fs from 'fs';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL required');
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

const arrayColumns = [
  'pros',
  'cons',
  'inspection_tips',
  'notable_features',
  'engine_examples',
  'common_issues_by_engine'
];

async function main() {
  await client.connect();

  const report = {
    generated_at: new Date().toISOString(),
    summary: {},
    issues: {
      models_without_insights: [],
      empty_arrays: {},
      missing_scores: [],
      missing_translations: {},
      duplicates: []
    }
  };

  // 1. Базовая статистика
  console.log('📊 Собираю базовую статистику...');
  const stats = await client.query(`
    select
      (select count(*) from vehicle_makes) as makes_count,
      (select count(*) from vehicle_models) as models_count,
      (select count(*) from vehicle_generations) as generations_count,
      (select count(*) from vehicle_insights) as insights_count
  `);
  report.summary = stats.rows[0];

  // 2. Модели без insights
  console.log('🔍 Проверяю модели без insights...');
  const noInsights = await client.query(`
    select mk.slug as make_slug, m.slug, m.name_en, m.id
    from vehicle_models m
    join vehicle_makes mk on mk.id = m.make_id
    left join vehicle_insights i on i.model_id = m.id
    where i.model_id is null
    order by mk.slug, m.name_en
  `);
  report.issues.models_without_insights = noInsights.rows;

  // 3. Пустые массивы в insights
  console.log('🔍 Проверяю пустые массивы...');
  for (const column of arrayColumns) {
    const empty = await client.query(`
      select mk.slug as make_slug, m.slug as model_slug, m.name_en
      from vehicle_insights i
      join vehicle_models m on m.id = i.model_id
      join vehicle_makes mk on mk.id = m.make_id
      where jsonb_typeof(i.${column}) = 'array' and jsonb_array_length(i.${column}) = 0
    `);
    if (empty.rowCount > 0) {
      report.issues.empty_arrays[column] = empty.rows;
    }
  }

  // 4. Отсутствующие оценки
  console.log('🔍 Проверяю оценки...');
  const noScores = await client.query(`
    select mk.slug as make_slug, m.slug as model_slug, m.name_en, i.model_id
    from vehicle_insights i
    join vehicle_models m on m.id = i.model_id
    join vehicle_makes mk on mk.id = m.make_id
    where i.reliability_score is null or i.popularity_score is null
  `);
  report.issues.missing_scores = noScores.rows;

  // 5. Переводы
  console.log('🔍 Проверяю переводы...');
  const i18nCounts = {
    makes: {},
    models: {},
    generations: {}
  };

  for (const locale of ['de', 'en', 'fr', 'nl', 'ru']) {
    const makesCount = await client.query('select count(*) from vehicle_make_i18n where locale = $1', [locale]);
    const modelsCount = await client.query('select count(*) from vehicle_model_i18n where locale = $1', [locale]);
    const gensCount = await client.query('select count(*) from vehicle_generation_i18n where locale = $1', [locale]);
    
    i18nCounts.makes[locale] = parseInt(makesCount.rows[0].count, 10);
    i18nCounts.models[locale] = parseInt(modelsCount.rows[0].count, 10);
    i18nCounts.generations[locale] = parseInt(gensCount.rows[0].count, 10);
  }

  report.issues.missing_translations = {
    summary: i18nCounts,
    models_without_any_translation: []
  };

  // Модели без переводов
  const noTranslations = await client.query(`
    select mk.slug as make_slug, m.slug, m.name_en, m.id
    from vehicle_models m
    join vehicle_makes mk on mk.id = m.make_id
    left join vehicle_model_i18n i on i.model_id = m.id
    where i.model_id is null
    group by mk.slug, m.slug, m.name_en, m.id
    order by mk.slug, m.name_en
  `);
  report.issues.missing_translations.models_without_any_translation = noTranslations.rows;

  // 6. Дубликаты (нормализованные имена)
  console.log('🔍 Проверяю дубликаты...');
  const models = await client.query(`
    select mk.slug as make_slug, m.slug, m.name_en
    from vehicle_models m
    join vehicle_makes mk on mk.id = m.make_id
  `);

  const groups = new Map();
  for (const row of models.rows) {
    const normalized = row.name_en
      .replace(/^bmw\s+/i, '')
      .replace(/^audi\s+/i, '')
      .replace(/^mercedes-benz\s+/i, '')
      .trim()
      .toLowerCase();
    const key = `${row.make_slug}::${normalized}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  for (const [key, rows] of groups.entries()) {
    if (rows.length > 1) {
      report.issues.duplicates.push({ key, models: rows });
    }
  }

  // Сохранить отчёт
  const outputPath = 'audit-report.json';
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n✅ Аудит завершён!');
  console.log(`\n📄 Отчёт сохранён: ${outputPath}`);
  console.log('\n📊 Сводка:');
  console.log(`  Марок: ${report.summary.makes_count}`);
  console.log(`  Моделей: ${report.summary.models_count}`);
  console.log(`  Поколений: ${report.summary.generations_count}`);
  console.log(`  Инсайтов: ${report.summary.insights_count}`);
  console.log(`\n⚠️  Проблемы:`);
  console.log(`  Моделей без insights: ${report.issues.models_without_insights.length}`);
  console.log(`  Моделей без оценок: ${report.issues.missing_scores.length}`);
  console.log(`  Моделей без переводов: ${report.issues.missing_translations.models_without_any_translation.length}`);
  console.log(`  Групп дубликатов: ${report.issues.duplicates.length}`);
  
  let emptyArraysTotal = 0;
  for (const [column, rows] of Object.entries(report.issues.empty_arrays)) {
    console.log(`  Пустых ${column}: ${rows.length}`);
    emptyArraysTotal += rows.length;
  }

  await client.end();
}

main().catch(err => {
  console.error('❌ Ошибка:', err);
  process.exit(1);
});

