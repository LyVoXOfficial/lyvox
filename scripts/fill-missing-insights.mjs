#!/usr/bin/env node
/**
 * Заполнение недостающих insights для моделей
 * Читает audit-report.json и генерирует данные через AI
 */
import pg from 'pg';
import fs from 'fs';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '10', 10);
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
  const models = ['gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'];
  
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
          maxOutputTokens: 8192
        }
      };
      
      const res = await fetch(url, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(body) 
      });
      
      if (!res.ok) {
        const err = await res.text();
        console.error(`   ⚠️  Model ${model} failed:`, err.slice(0, 200));
        continue;
      }
      
      const data = await res.json();
      let text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
      
      // Remove markdown code blocks if present
      text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      
      return text;
    } catch (err) {
      console.error(`   ⚠️  Model ${model} error:`, err.message);
    }
  }
  
  throw new Error('All Google AI models failed');
}

async function generateInsights(modelsData) {
  const prompt = `You are an automotive expert. Generate comprehensive insights for the following vehicles.

For each vehicle, provide:
- pros: array of 3-5 advantages (in English)
- cons: array of 3-5 disadvantages (in English)
- inspection_tips: array of 3-5 tips for buyers (in English)
- notable_features: array of 2-4 notable features (in English)
- engine_examples: array of 2-4 common engine codes/descriptions
- common_issues_by_engine: array of objects with engine_code and common_issues_ru (in Russian)
- reliability_score: INTEGER 0-10
- popularity_score: INTEGER 0-10
- generations: array of generation objects with code, start_year, end_year, facelift, production_countries, body_types, fuel_types, transmission_types, summary

Respond with ONLY a JSON array (no markdown):

${JSON.stringify(modelsData.map(m => ({ make: m.make_slug, model: m.name_en, slug: m.slug })), null, 2)}

Example format:
[
  {
    "slug": "model-slug",
    "pros": ["Reliable engine", "Good fuel economy"],
    "cons": ["Expensive parts"],
    "inspection_tips": ["Check for rust"],
    "notable_features": ["AWD system"],
    "engine_examples": ["2.0L I4", "3.0L V6"],
    "common_issues_by_engine": [
      {
        "engine_code": "M50B25",
        "common_issues_ru": ["Утечка масла", "Износ цепи ГРМ"]
      }
    ],
    "reliability_score": 8,
    "popularity_score": 8,
    "generations": [
      {
        "code": "Generation I (1990-1995)",
        "start_year": 1990,
        "end_year": 1995,
        "facelift": false,
        "production_countries": ["Germany"],
        "body_types": ["Sedan"],
        "fuel_types": ["Gasoline"],
        "transmission_types": ["Manual", "Automatic"],
        "summary": "First generation description"
      }
    ]
  }
]`;

  const response = await callGoogleAI(prompt);
  return JSON.parse(response);
}

async function main() {
  await client.connect();

  // Читаем отчёт
  if (!fs.existsSync('audit-report.json')) {
    console.error('❌ audit-report.json не найден. Запустите сначала audit-full-coverage.mjs');
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync('audit-report.json', 'utf8'));
  const modelsWithoutInsights = report.issues.models_without_insights;

  console.log(`📊 Найдено моделей без insights: ${modelsWithoutInsights.length}`);

  if (modelsWithoutInsights.length === 0) {
    console.log('✅ Все модели уже имеют insights!');
    await client.end();
    return;
  }

  if (DRY_RUN) {
    console.log('🔍 DRY_RUN режим - показываю что будет обработано:');
    modelsWithoutInsights.slice(0, 20).forEach(m => {
      console.log(`  ${m.make_slug} / ${m.slug} (${m.name_en})`);
    });
    if (modelsWithoutInsights.length > 20) {
      console.log(`  ... и ещё ${modelsWithoutInsights.length - 20} моделей`);
    }
    await client.end();
    return;
  }

  let processed = 0;
  const batches = [];
  for (let i = 0; i < modelsWithoutInsights.length; i += BATCH_SIZE) {
    batches.push(modelsWithoutInsights.slice(i, i + BATCH_SIZE));
  }

  console.log(`📦 Обработка ${batches.length} батчей по ${BATCH_SIZE} моделей...`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`\n📦 Batch ${i + 1}/${batches.length} (${batch.length} моделей)...`);

    try {
      const insights = await generateInsights(batch);

      // Сохранить в БД
      for (const insight of insights) {
        const model = batch.find(m => m.slug === insight.slug);
        if (!model) continue;

        // Вставить insights
        const reliabilityScore = insight.reliability_score ? Math.round(parseFloat(insight.reliability_score)) : null;
        const popularityScore = insight.popularity_score ? Math.round(parseFloat(insight.popularity_score)) : null;
        
        await client.query(`
          insert into vehicle_insights (
            model_id, pros, cons, inspection_tips, notable_features,
            engine_examples, common_issues_by_engine, reliability_score, popularity_score
          ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          on conflict (model_id) do update set
            pros = EXCLUDED.pros,
            cons = EXCLUDED.cons,
            inspection_tips = EXCLUDED.inspection_tips,
            notable_features = EXCLUDED.notable_features,
            engine_examples = EXCLUDED.engine_examples,
            common_issues_by_engine = EXCLUDED.common_issues_by_engine,
            reliability_score = EXCLUDED.reliability_score,
            popularity_score = EXCLUDED.popularity_score
        `, [
          model.id,
          JSON.stringify(insight.pros || []),
          JSON.stringify(insight.cons || []),
          JSON.stringify(insight.inspection_tips || []),
          JSON.stringify(insight.notable_features || []),
          JSON.stringify(insight.engine_examples || []),
          JSON.stringify(insight.common_issues_by_engine || []),
          reliabilityScore,
          popularityScore
        ]);

        // Вставить generations
        if (insight.generations && Array.isArray(insight.generations)) {
          for (const gen of insight.generations) {
            const genId = crypto.randomUUID();
            await client.query(`
              insert into vehicle_generations (
                id, model_id, code, start_year, end_year, facelift,
                production_countries, body_types, fuel_types, transmission_types, summary
              ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              on conflict (id) do nothing
            `, [
              genId,
              model.id,
              gen.code,
              gen.start_year,
              gen.end_year,
              gen.facelift || false,
              gen.production_countries || [],
              JSON.stringify(gen.body_types || []),
              JSON.stringify(gen.fuel_types || []),
              JSON.stringify(gen.transmission_types || []),
              gen.summary || null
            ]);
          }
        }

        processed++;
      }

      console.log(`   ✅ Обработано: ${insights.length} моделей`);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (err) {
      console.error(`   ❌ Ошибка batch ${i + 1}:`, err.message);
    }
  }

  console.log(`\n✅ Завершено! Обработано моделей: ${processed}`);
  await client.end();
}

main().catch(err => {
  console.error('❌ Ошибка:', err);
  process.exit(1);
});

