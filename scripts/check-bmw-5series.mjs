#!/usr/bin/env node
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
const client = new pg.Client({ connectionString: DATABASE_URL });

async function main() {
  await client.connect();
  
  const result = await client.query(`
    select 
      m.name_en, 
      m.slug, 
      m.first_model_year,
      m.last_model_year,
      array_length(m.years_available, 1) as years_count,
      (select count(*) from vehicle_generations g where g.model_id = m.id) as generations_count,
      (select count(*) from vehicle_insights i where i.model_id = m.id) as insights_count
    from vehicle_models m
    join vehicle_makes mk on mk.id = m.make_id
    where mk.slug = 'bmw' and m.slug = '5-series'
  `);
  
  if (result.rows.length > 0) {
    const row = result.rows[0];
    console.log('✅ BMW 5 Series найден:');
    console.log('   Название:', row.name_en);
    console.log('   Первый год:', row.first_model_year);
    console.log('   Последний год:', row.last_model_year);
    console.log('   Всего годов в массиве:', row.years_count);
    console.log('   Поколений:', row.generations_count);
    console.log('   Insights:', row.insights_count ? 'Да ✅' : 'Нет ❌');
    
    // Проверка E60/E61
    const e61 = await client.query(`
      select g.code, g.start_year, g.end_year
      from vehicle_generations g
      join vehicle_models m on m.id = g.model_id
      join vehicle_makes mk on mk.id = m.make_id
      where mk.slug = 'bmw' and m.slug = '5-series'
      order by g.start_year
    `);
    
    console.log('\n📋 Поколения:');
    let e61Found = false;
    e61.rows.forEach((gen, idx) => {
      console.log(`   ${idx + 1}. ${gen.code} (${gen.start_year}-${gen.end_year})`);
      if (gen.code && gen.code.includes('E60')) e61Found = true;
    });
    
    if (e61Found) {
      console.log('\n✅ E60/E61 поколение ПРИСУТСТВУЕТ!');
    } else {
      console.log('\n⚠️  E60/E61 поколение НЕ НАЙДЕНО');
    }
  } else {
    console.log('❌ BMW 5 Series не найден');
  }
  
  await client.end();
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});


