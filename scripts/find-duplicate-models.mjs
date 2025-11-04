#!/usr/bin/env node
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL required');
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

function normalizeName(name = '') {
  return name.replace(/^bmw\s+/i, '').replace(/^mercedes-benz\s+/i, '').replace(/^audi\s+/i, '').trim().toLowerCase();
}

try {
  await client.connect();

  const res = await client.query(`
    select mk.slug as make_slug, m.slug, m.name_en, m.first_model_year, m.last_model_year,
           count(distinct g.id) as generations
    from vehicle_models m
    join vehicle_makes mk on mk.id = m.make_id
    left join vehicle_generations g on g.model_id = m.id
    group by mk.slug, m.id, m.slug, m.name_en, m.first_model_year, m.last_model_year
    order by mk.slug, m.name_en;
  `);

  const duplicates = new Map();

  for (const row of res.rows) {
    const key = `${row.make_slug}::${normalizeName(row.name_en)}`;
    if (!duplicates.has(key)) {
      duplicates.set(key, []);
    }
    duplicates.get(key).push(row);
  }

  let duplicateCount = 0;

  for (const [key, rows] of duplicates.entries()) {
    if (rows.length <= 1) continue;
    duplicateCount++;
    console.log(`\n🔁 Дубликаты для ${rows[0].make_slug} → "${rows[0].name_en}" (норм):`);
    rows.forEach(r => {
      console.log(`  slug=${r.slug} | name=${r.name_en} | ${r.first_model_year}-${r.last_model_year} | generations=${r.generations}`);
    });
  }

  if (duplicateCount === 0) {
    console.log('✅ Дубликатов не найдено (по нормализованным названиям)');
  } else {
    console.log(`\n⚠️  Всего найдено групп дубликатов: ${duplicateCount}`);
  }

} catch (err) {
  console.error('❌ Ошибка:', err.message);
} finally {
  await client.end().catch(() => {});
}


