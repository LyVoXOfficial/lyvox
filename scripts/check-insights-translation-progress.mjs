#!/usr/bin/env node
/**
 * Проверка прогресса перевода insights
 */
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL required');
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

async function checkProgress() {
  await client.connect();

  const totalModels = await client.query(`
    SELECT COUNT(*) FROM vehicle_insights
  `);

  const translatedModels = await client.query(`
    SELECT model_id, COUNT(DISTINCT locale) as locale_count
    FROM vehicle_insights_i18n
    GROUP BY model_id
    HAVING COUNT(DISTINCT locale) = 5
  `);

  const partialTranslations = await client.query(`
    SELECT locale, COUNT(*) as count
    FROM vehicle_insights_i18n
    GROUP BY locale
    ORDER BY locale
  `);

  console.log('\n📊 ПРОГРЕСС ПЕРЕВОДА INSIGHTS:\n');
  console.log(`  Всего моделей:           ${totalModels.rows[0].count}`);
  console.log(`  Полностью переведено:    ${translatedModels.rowCount} (на все 5 языков)`);
  
  const percent = ((translatedModels.rowCount / totalModels.rows[0].count) * 100).toFixed(1);
  console.log(`  Прогресс:                ${percent}%\n`);

  console.log('📋 Переводы по языкам:\n');
  for (const row of partialTranslations.rows) {
    const langPercent = ((row.count / totalModels.rows[0].count) * 100).toFixed(1);
    console.log(`  ${row.locale.toUpperCase()}: ${row.count} моделей (${langPercent}%)`);
  }

  await client.end();
}

checkProgress().catch(err => {
  console.error('❌ Ошибка:', err);
  process.exit(1);
});


