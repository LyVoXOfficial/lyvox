#!/usr/bin/env node
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  
  const result = await client.query(`
    SELECT 
      m.name_en,
      m.slug,
      COUNT(g.id) as gen_count
    FROM vehicle_models m
    LEFT JOIN vehicle_generations g ON g.model_id = m.id
    WHERE m.slug IN ('3-series', '5-series', 'x5', '1-series', '2-series')
    GROUP BY m.id, m.name_en, m.slug
    ORDER BY m.slug
  `);
  
  console.log('\n📊 Поколения для BMW:\n');
  result.rows.forEach(row => {
    const status = row.gen_count > 0 ? '✅ Enriched' : '⚠️  Basic only';
    console.log(`${row.name_en} (${row.slug}): ${row.gen_count} поколений ${status}`);
  });
  
} catch (err) {
  console.error('❌ Ошибка:', err.message);
} finally {
  await client.end().catch(() => {});
}

