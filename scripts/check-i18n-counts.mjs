#!/usr/bin/env node
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is required');
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

try {
  await client.connect();

  const queries = {
    'vehicle_make_i18n': 'select locale, count(*) as count from vehicle_make_i18n group by locale order by locale',
    'vehicle_model_i18n': 'select locale, count(*) as count from vehicle_model_i18n group by locale order by locale',
    'vehicle_generation_i18n': 'select locale, count(*) as count from vehicle_generation_i18n group by locale order by locale'
  };

  for (const [table, sql] of Object.entries(queries)) {
    console.log(`\n${table}`);
    const res = await client.query(sql);
    if (res.rowCount === 0) {
      console.log('  (пусто)');
      continue;
    }
    res.rows.forEach(row => {
      console.log(`  ${row.locale}: ${row.count}`);
    });
  }

} catch (err) {
  console.error('❌ Ошибка:', err.message);
} finally {
  await client.end().catch(() => {});
}


