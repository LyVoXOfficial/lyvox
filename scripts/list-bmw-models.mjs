#!/usr/bin/env node
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL required');
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

try {
  await client.connect();

  const res = await client.query(`
    select m.slug, m.name_en, m.first_model_year, m.last_model_year
    from vehicle_models m
    join vehicle_makes mk on mk.id = m.make_id
    where mk.slug = 'bmw'
    order by m.name_en;
  `);

  console.log('\nBMW models in DB (slug | name | years):\n');
  res.rows.forEach(row => {
    console.log(`${row.slug} | ${row.name_en} | ${row.first_model_year ?? 'null'}-${row.last_model_year ?? 'null'}`);
  });

} catch (err) {
  console.error('❌ Ошибка:', err.message);
} finally {
  await client.end().catch(() => {});
}


