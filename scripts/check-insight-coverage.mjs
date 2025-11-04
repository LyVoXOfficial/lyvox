#!/usr/bin/env node
import pg from 'pg';

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

(async () => {
  await client.connect();

  const totalRes = await client.query('select count(*) from vehicle_insights');
  const total = parseInt(totalRes.rows[0].count, 10);
  console.log(`Всего записей в vehicle_insights: ${total}`);

  const rows = await client.query(`
    select
      ${arrayColumns
        .map(column => `
      sum(case when ${column} is null then 1 else 0 end) as ${column}_null,
      sum(case when ${column} is not null and jsonb_typeof(${column}) = 'array' and jsonb_array_length(${column}) = 0 then 1 else 0 end) as ${column}_empty`)
        .join(',')},
      sum(case when reliability_score is null then 1 else 0 end) as reliability_null,
      sum(case when popularity_score is null then 1 else 0 end) as popularity_null
    from vehicle_insights;
  `);

  const result = rows.rows[0];

  console.log('\nПустые / отсутствующие массивы:');
  arrayColumns.forEach(column => {
    const nullCount = parseInt(result[`${column}_null`], 10);
    const emptyCount = parseInt(result[`${column}_empty`], 10);
    console.log(`  ${column}: null=${nullCount}, пустых массивов=${emptyCount}`);
  });

  console.log('\nОтсутствующие числовые оценки:');
  console.log(`  reliability_score null: ${parseInt(result.reliability_null, 10)}`);
  console.log(`  popularity_score null: ${parseInt(result.popularity_null, 10)}`);

  await client.end();
})();


