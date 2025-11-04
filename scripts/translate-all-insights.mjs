#!/usr/bin/env node
/**
 * КРИТИЧНО: Перевод всех insights на 5 языков
 * Переводит pros, cons, inspection_tips, notable_features, engine_examples, common_issues
 */
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '10', 10);

if (!DATABASE_URL || !GOOGLE_API_KEY) {
  console.error('❌ DATABASE_URL and GOOGLE_API_KEY required');
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

const LANGUAGES = {
  'en': 'English',
  'de': 'German',
  'fr': 'French',
  'nl': 'Dutch',
  'ru': 'Russian'
};

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
          maxOutputTokens: 8192
        }
      };
      
      const res = await fetch(url, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(body) 
      });
      
      if (!res.ok) {
        continue;
      }
      
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

async function translateInsights(insights) {
  const prompt = `You are a professional automotive translator. Translate the following vehicle insights to ${Object.values(LANGUAGES).join(', ')}.

SOURCE (Russian):
${JSON.stringify(insights, null, 2)}

Respond with ONLY a JSON object (no markdown) with this structure:
{
  "en": {
    "pros": ["English translation 1", "English translation 2"],
    "cons": ["English translation 1"],
    "inspection_tips": ["English translation 1"],
    "notable_features": ["English translation 1"],
    "engine_examples": ["English translation 1"],
    "common_issues": ["English translation 1"]
  },
  "de": { ... },
  "fr": { ... },
  "nl": { ... },
  "ru": {
    "pros": ${JSON.stringify(insights.pros || [])},
    "cons": ${JSON.stringify(insights.cons || [])},
    "inspection_tips": ${JSON.stringify(insights.inspection_tips || [])},
    "notable_features": ${JSON.stringify(insights.notable_features || [])},
    "engine_examples": ${JSON.stringify(insights.engine_examples || [])},
    "common_issues": ${JSON.stringify(insights.common_issues || [])}
  }
}

Keep Russian (ru) as-is. Translate accurately for automotive context.`;

  const response = await callGoogleAI(prompt);
  return JSON.parse(response);
}

async function main() {
  await client.connect();

  console.log('🔍 Получение непереведённых insights из БД...\n');

  const allInsights = await client.query(`
    SELECT 
      i.model_id,
      i.pros,
      i.cons,
      i.inspection_tips,
      i.notable_features,
      i.engine_examples,
      i.common_issues_by_engine,
      mk.slug as make_slug,
      m.name_en as model_name
    FROM vehicle_insights i
    JOIN vehicle_models m ON m.id = i.model_id
    JOIN vehicle_makes mk ON mk.id = m.make_id
    WHERE NOT EXISTS (
      SELECT 1 FROM vehicle_insights_i18n 
      WHERE model_id = i.model_id 
      GROUP BY model_id 
      HAVING COUNT(DISTINCT locale) = 5
    )
    ORDER BY mk.slug, m.name_en
  `);

  console.log(`📊 Найдено insights: ${allInsights.rowCount}\n`);

  const batches = [];
  for (let i = 0; i < allInsights.rows.length; i += BATCH_SIZE) {
    batches.push(allInsights.rows.slice(i, i + BATCH_SIZE));
  }

  console.log(`📦 Обработка ${batches.length} батчей по ${BATCH_SIZE} моделей...\n`);

  let processed = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`📦 Batch ${i + 1}/${batches.length} (${batch.length} моделей)...`);

    for (const model of batch) {
      console.log(`   🔧 ${model.make_slug} / ${model.model_name}...`);

      // Extract common_issues from common_issues_by_engine
      let common_issues = [];
      if (model.common_issues_by_engine && Array.isArray(model.common_issues_by_engine)) {
        common_issues = model.common_issues_by_engine.flatMap(item => 
          item.common_issues_ru || []
        );
      }

      const insights = {
        pros: model.pros || [],
        cons: model.cons || [],
        inspection_tips: model.inspection_tips || [],
        notable_features: model.notable_features || [],
        engine_examples: model.engine_examples || [],
        common_issues: common_issues
      };

      try {
        const translations = await translateInsights(insights);

        // Insert translations for all languages
        for (const [locale, trans] of Object.entries(translations)) {
          await client.query(`
            INSERT INTO vehicle_insights_i18n (
              model_id, locale, pros, cons, inspection_tips, 
              notable_features, engine_examples, common_issues
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (model_id, locale) DO UPDATE SET
              pros = EXCLUDED.pros,
              cons = EXCLUDED.cons,
              inspection_tips = EXCLUDED.inspection_tips,
              notable_features = EXCLUDED.notable_features,
              engine_examples = EXCLUDED.engine_examples,
              common_issues = EXCLUDED.common_issues
          `, [
            model.model_id,
            locale,
            trans.pros || [],
            trans.cons || [],
            trans.inspection_tips || [],
            trans.notable_features || [],
            trans.engine_examples || [],
            trans.common_issues || []
          ]);
        }

        processed++;
        console.log(`      ✅ Переведено на ${Object.keys(translations).length} языков`);

        await new Promise(resolve => setTimeout(resolve, 800));

      } catch (err) {
        console.error(`      ❌ Ошибка:`, err.message);
      }
    }
  }

  console.log(`\n✅ Завершено! Переведено моделей: ${processed}`);
  await client.end();
}

main().catch(err => {
  console.error('❌ Критическая ошибка:', err);
  process.exit(1);
});

