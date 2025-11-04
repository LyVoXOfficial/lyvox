#!/usr/bin/env node
/**
 * Заполнение reliability_score и popularity_score
 * для моделей где они отсутствуют
 */
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '20', 10);
const DRY_RUN = process.env.DRY_RUN === 'true';

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL required');
  process.exit(1);
}

if (!GOOGLE_API_KEY && !DRY_RUN) {
  console.error('❌ GOOGLE_API_KEY required (or use DRY_RUN=true)');
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
          maxOutputTokens: 2048
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

async function generateScores(modelsData) {
  const prompt = `You are an automotive expert. Rate the following vehicles on reliability and popularity (scale 0-10).

Reliability factors: build quality, common issues, repair costs, longevity
Popularity factors: sales volume, market presence, brand recognition, enthusiast following

IMPORTANT: Scores must be INTEGERS (0-10), not decimals.

Respond with ONLY a JSON array:

${JSON.stringify(modelsData.map(m => ({ make: m.make_slug, model: m.name_en })), null, 2)}

Example:
[
  { "model": "Camry", "reliability_score": 9, "popularity_score": 9 },
  { "model": "911", "reliability_score": 8, "popularity_score": 9 }
]`;

  const response = await callGoogleAI(prompt);
  return JSON.parse(response);
}

async function main() {
  await client.connect();

  console.log('🔍 Поиск моделей с отсутствующими оценками...');

  const modelsWithoutScores = await client.query(`
    select mk.slug as make_slug, m.slug as model_slug, m.name_en, i.model_id
    from vehicle_insights i
    join vehicle_models m on m.id = i.model_id
    join vehicle_makes mk on mk.id = m.make_id
    where i.reliability_score is null or i.popularity_score is null
  `);

  console.log(`📊 Найдено моделей: ${modelsWithoutScores.rowCount}`);

  if (modelsWithoutScores.rowCount === 0) {
    console.log('✅ Все модели уже имеют оценки!');
    await client.end();
    return;
  }

  if (DRY_RUN) {
    console.log('🔍 DRY_RUN режим - показываю первые 20:');
    modelsWithoutScores.rows.slice(0, 20).forEach(m => {
      console.log(`  ${m.make_slug} / ${m.model_slug} (${m.name_en})`);
    });
    if (modelsWithoutScores.rowCount > 20) {
      console.log(`  ... и ещё ${modelsWithoutScores.rowCount - 20}`);
    }
    await client.end();
    return;
  }

  let processed = 0;
  const batches = [];
  for (let i = 0; i < modelsWithoutScores.rows.length; i += BATCH_SIZE) {
    batches.push(modelsWithoutScores.rows.slice(i, i + BATCH_SIZE));
  }

  console.log(`📦 Обработка ${batches.length} батчей по ${BATCH_SIZE} моделей...`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`\n📦 Batch ${i + 1}/${batches.length}...`);

    try {
      const scores = await generateScores(batch);

      for (const score of scores) {
        const model = batch.find(m => m.name_en === score.model || m.model_slug.includes(score.model.toLowerCase().replace(/\s+/g, '-')));
        if (!model) continue;

        const reliabilityScore = score.reliability_score ? Math.round(parseFloat(score.reliability_score)) : null;
        const popularityScore = score.popularity_score ? Math.round(parseFloat(score.popularity_score)) : null;

        await client.query(`
          update vehicle_insights
          set reliability_score = $1, popularity_score = $2
          where model_id = $3
        `, [reliabilityScore, popularityScore, model.model_id]);

        processed++;
      }

      console.log(`   ✅ Обработано: ${scores.length} моделей`);
      await new Promise(resolve => setTimeout(resolve, 1500));

    } catch (err) {
      console.error(`   ❌ Ошибка batch ${i + 1}:`, err.message);
    }
  }

  console.log(`\n✅ Завершено! Обновлено моделей: ${processed}`);
  await client.end();
}

main().catch(err => {
  console.error('❌ Ошибка:', err);
  process.exit(1);
});

