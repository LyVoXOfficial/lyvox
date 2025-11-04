#!/usr/bin/env node
import pg from 'pg';

const { DATABASE_URL, MODEL_SLUG } = process.env;

if (!DATABASE_URL || !MODEL_SLUG) {
  console.error('Usage: MODEL_SLUG=slug DATABASE_URL=... node scripts/debug-model.mjs');
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

try {
  await client.connect();
  const res = await client.query(`
    select m.id, m.slug, m.name_en, m.first_model_year, m.last_model_year,
           count(distinct g.id) as generations
    from vehicle_models m
    left join vehicle_generations g on g.model_id = m.id
    where m.slug = $1
    group by m.id
  `, [MODEL_SLUG]);

  if (res.rowCount === 0) {
    console.log('❌ Model not found');
    process.exit(0);
  }

  console.log(res.rows[0]);

  const gens = await client.query(`
    select g.id, g.code, g.start_year, g.end_year
    from vehicle_generations g
    where g.model_id = $1
    order by g.start_year
  `, [res.rows[0].id]);

  console.log('\nGenerations:');
  gens.rows.forEach(row => console.log(`  ${row.code} (${row.start_year}-${row.end_year})`));

} catch (err) {
  console.error('❌ Ошибка:', err.message);
} finally {
  await client.end().catch(() => {});
}


