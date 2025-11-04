#!/usr/bin/env node
/**
 * Исправление оставшихся 11 моделей без scores
 */
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!DATABASE_URL || !GOOGLE_API_KEY) {
  console.error('❌ DATABASE_URL and GOOGLE_API_KEY required');
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

async function callGoogleAI(prompt) {
  const models = ['gemini-2.0-flash-lite', 'gemini-2.5-flash'];
  
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GOOGLE_API_KEY)}`;
      const body = {
        contents: [{ 
          role: 'user', 
          parts: [{ text: prompt }] 
        }],
        generationConfig: { 
          temperature: 0.2, 
          maxOutputTokens: 1024
        }
      };
      
      const res = await fetch(url, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(body) 
      });
      
      if (!res.ok) continue;
      
      const data = await res.json();
      let text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
      text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      
      return text;
    } catch (err) {
      console.error(`   ⚠️  Model ${model} error:`, err.message);
    }
  }
  
  throw new Error('All Google AI models failed');
}

async function main() {
  await client.connect();

  console.log('🔍 Поиск моделей без scores...\n');

  const modelsWithoutScores = await client.query(`
    select mk.slug as make_slug, m.slug as model_slug, m.name_en, m.id
    from vehicle_models m
    join vehicle_makes mk on mk.id = m.make_id
    left join vehicle_insights i on i.model_id = m.id
    where i.model_id is null or i.reliability_score is null or i.popularity_score is null
    order by mk.slug, m.name_en
  `);

  console.log(`📊 Найдено моделей: ${modelsWithoutScores.rowCount}\n`);

  if (modelsWithoutScores.rowCount === 0) {
    console.log('✅ Все модели имеют scores!');
    await client.end();
    return;
  }

  for (const model of modelsWithoutScores.rows) {
    console.log(`🔧 ${model.make_slug} / ${model.model_slug} (${model.name_en})...`);

    const prompt = `Rate this vehicle on reliability and popularity (scale 0-10).
    
Make: ${model.make_slug}
Model: ${model.name_en}

Reliability factors: build quality, common issues, repair costs, longevity
Popularity factors: sales volume, market presence, brand recognition

IMPORTANT: Scores must be INTEGERS (0-10), not decimals.

Respond with ONLY a JSON object (no markdown):
{
  "reliability_score": 7,
  "popularity_score": 8
}`;

    try {
      const response = await callGoogleAI(prompt);
      const scores = JSON.parse(response);
      
      const reliabilityScore = Math.round(parseFloat(scores.reliability_score));
      const popularityScore = Math.round(parseFloat(scores.popularity_score));

      // Check if insights exist
      const insightExists = await client.query(
        'select model_id from vehicle_insights where model_id = $1',
        [model.id]
      );

      if (insightExists.rowCount > 0) {
        // Update existing
        await client.query(`
          update vehicle_insights
          set reliability_score = $1, popularity_score = $2
          where model_id = $3
        `, [reliabilityScore, popularityScore, model.id]);
      } else {
        // Insert new with minimal data
        await client.query(`
          insert into vehicle_insights (
            model_id, reliability_score, popularity_score,
            pros, cons, inspection_tips, notable_features,
            engine_examples, common_issues_by_engine
          ) values ($1, $2, $3, $4, $4, $4, $4, $4, $4)
        `, [
          model.id, 
          reliabilityScore, 
          popularityScore,
          JSON.stringify([])
        ]);
      }

      console.log(`   ✅ Scores: reliability=${reliabilityScore}, popularity=${popularityScore}`);
      await new Promise(resolve => setTimeout(resolve, 1500));

    } catch (err) {
      console.error(`   ❌ Ошибка:`, err.message);
    }
  }

  console.log(`\n✅ Все модели обработаны!`);
  await client.end();
}

main().catch(err => {
  console.error('❌ Критическая ошибка:', err);
  process.exit(1);
});


