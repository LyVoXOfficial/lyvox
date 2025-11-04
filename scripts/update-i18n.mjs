#!/usr/bin/env node
/**
 * Обновление переводов для новых моделей
 * Запускает normalize и expand с проверкой покрытия
 */
import { spawn } from 'child_process';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL required');
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Запуск: ${scriptPath}`);
    const proc = spawn('node', [scriptPath], { 
      stdio: 'inherit',
      env: { ...process.env }
    });
    
    proc.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script ${scriptPath} exited with code ${code}`));
      }
    });
  });
}

async function checkCoverage() {
  console.log('\n📊 Проверка покрытия переводов...');
  
  const counts = {
    makes: {},
    models: {},
    generations: {}
  };

  for (const locale of ['de', 'en', 'fr', 'nl', 'ru']) {
    const makesCount = await client.query('select count(*) from vehicle_make_i18n where locale = $1', [locale]);
    const modelsCount = await client.query('select count(*) from vehicle_model_i18n where locale = $1', [locale]);
    const gensCount = await client.query('select count(*) from vehicle_generation_i18n where locale = $1', [locale]);
    
    counts.makes[locale] = parseInt(makesCount.rows[0].count, 10);
    counts.models[locale] = parseInt(modelsCount.rows[0].count, 10);
    counts.generations[locale] = parseInt(gensCount.rows[0].count, 10);
  }

  console.log('\n📊 Переводы по языкам:');
  console.log('  Марки:');
  for (const [locale, count] of Object.entries(counts.makes)) {
    console.log(`    ${locale}: ${count}`);
  }
  console.log('  Модели:');
  for (const [locale, count] of Object.entries(counts.models)) {
    console.log(`    ${locale}: ${count}`);
  }
  console.log('  Поколения:');
  for (const [locale, count] of Object.entries(counts.generations)) {
    console.log(`    ${locale}: ${count}`);
  }

  // Проверить модели без переводов
  const noTranslations = await client.query(`
    select mk.slug as make_slug, m.slug, m.name_en, count(i.model_id) as translation_count
    from vehicle_models m
    join vehicle_makes mk on mk.id = m.make_id
    left join vehicle_model_i18n i on i.model_id = m.id
    group by mk.slug, m.slug, m.name_en, m.id
    having count(i.model_id) < 5
    order by translation_count, mk.slug, m.name_en
    limit 20
  `);

  if (noTranslations.rowCount > 0) {
    console.log('\n⚠️  Модели с неполными переводами (первые 20):');
    noTranslations.rows.forEach(row => {
      console.log(`  ${row.make_slug} / ${row.slug} (${row.name_en}): ${row.translation_count}/5 переводов`);
    });
  }
}

async function main() {
  await client.connect();

  console.log('═══════════════════════════════════════');
  console.log('  Обновление переводов (i18n)');
  console.log('═══════════════════════════════════════');

  // Проверить текущее состояние
  await checkCoverage();

  // Запустить normalize
  try {
    await runScript('scripts/vehicle_i18n_normalize.mjs');
  } catch (err) {
    console.error('❌ Ошибка normalize:', err.message);
  }

  // Запустить expand
  try {
    await runScript('scripts/vehicle_i18n_expand.mjs');
  } catch (err) {
    console.error('❌ Ошибка expand:', err.message);
  }

  // Проверить финальное состояние
  console.log('\n═══════════════════════════════════════');
  console.log('  Финальное состояние');
  console.log('═══════════════════════════════════════');
  await checkCoverage();

  await client.end();
  console.log('\n✅ Обновление переводов завершено!');
}

main().catch(err => {
  console.error('❌ Ошибка:', err);
  process.exit(1);
});

