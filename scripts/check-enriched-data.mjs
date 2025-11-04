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
  
  // Check BMW 3 Series (should have enriched data)
  const result = await client.query(`
    SELECT 
      m.slug as model_slug,
      m.name_en,
      m.first_model_year,
      m.last_model_year,
      COUNT(DISTINCT g.id) as generations_count,
      COUNT(DISTINCT i.id) as insights_count
    FROM vehicle_models m
    LEFT JOIN vehicle_generations g ON g.model_id = m.id
    LEFT JOIN vehicle_insights i ON i.model_id = m.id
    WHERE m.slug IN ('3-series', '5-series', 'x5', '1-series', '2-series')
    GROUP BY m.id, m.slug, m.name_en, m.first_model_year, m.last_model_year
    ORDER BY m.slug
  `);
  
  console.log('📊 Проверка enriched данных для BMW:\n');
  
  for (const row of result.rows) {
    console.log(`${row.name_en} (${row.model_slug}):`);
    console.log(`  Годы: ${row.first_model_year}-${row.last_model_year}`);
    console.log(`  Поколений: ${row.generations_count}`);
    console.log(`  Insights: ${row.insights_count}`);
    
    if (row.generations_count > 0) {
      console.log(`  ✅ Enriched data available!`);
    } else {
      console.log(`  ⚠️  Basic data only (no generations)`);
    }
    console.log('');
  }
  
  // Check sample insight
  const insight = await client.query(`
    SELECT 
      i.pros,
      i.cons,
      i.inspection_tips,
      i.notable_features
    FROM vehicle_insights i
    JOIN vehicle_models m ON m.id = i.model_id
    WHERE m.slug = '3-series'
    LIMIT 1
  `);
  
  if (insight.rows.length > 0) {
    console.log('📝 Пример insight для 3 Series:');
    console.log(`  Pros: ${insight.rows[0].pros?.slice(0, 3).join(', ') || 'N/A'}`);
    console.log(`  Cons: ${insight.rows[0].cons?.slice(0, 3).join(', ') || 'N/A'}`);
    console.log(`  Notable features: ${insight.rows[0].notable_features?.slice(0, 3).join(', ') || 'N/A'}`);
  }
  
} catch (err) {
  console.error('❌ Ошибка:', err.message);
} finally {
  await client.end().catch(() => {});
}

