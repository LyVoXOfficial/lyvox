#!/usr/bin/env node
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL required');
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

(async () => {
  await client.connect();
  const res = await client.query(`
    select mk.slug as make_slug, m.slug, m.name_en
    from vehicle_models m
    join vehicle_makes mk on mk.id = m.make_id
    left join vehicle_insights i on i.model_id = m.id
    where i.model_id is null
    order by mk.slug, m.name_en
  `);

  console.log(`Моделей без insights: ${res.rowCount}`);
  res.rows.slice(0, 50).forEach(row => {
    console.log(`  ${row.make_slug} / ${row.slug} (${row.name_en})`);
  });
  if (res.rowCount > 50) {
    console.log('  ...');
  }

  await client.end();
})();


