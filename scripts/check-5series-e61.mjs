#!/usr/bin/env node
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  
  const result = await client.query(`
    SELECT 
      g.code,
      g.start_year,
      g.end_year
    FROM vehicle_generations g
    JOIN vehicle_models m ON m.id = g.model_id
    WHERE m.slug = '5-series'
    ORDER BY g.start_year
  `);
  
  console.log('\n📊 BMW 5 Series - ВСЕ поколения в БД:\n');
  
  if (result.rows.length === 0) {
    console.log('  ❌ Поколения не найдены!');
  } else {
    result.rows.forEach((row, idx) => {
      const isE61 = row.code.includes('E61') || row.code.includes('E60');
      const mark = isE61 ? '✅' : '  ';
      console.log(`${mark} ${idx + 1}. ${row.code} (${row.start_year}-${row.end_year})`);
    });
    
    const hasE61 = result.rows.some(r => r.code.includes('E61') || r.code.includes('E60'));
    console.log(`\n${hasE61 ? '✅' : '❌'} E60/E61 ${hasE61 ? 'НАЙДЕНО' : 'НЕ НАЙДЕНО'} в БД!`);
  }
  
} catch (err) {
  console.error('❌ Ошибка:', err.message);
} finally {
  await client.end().catch(() => {});
}

