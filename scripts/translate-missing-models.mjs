#!/usr/bin/env node
/**
 * Автоматический перевод всех моделей без переводов на все 5 языков
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

const LANGUAGES = ['de', 'en', 'fr', 'nl', 'ru'];

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
          maxOutputTokens: 4096
        }
      };
      
      const res = await fetch(url, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(body) 
      });
      
      if (!res.ok) {
        const err = await res.text();
        console.error(`   ⚠️  Model ${model} failed: ${err.slice(0, 100)}`);
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

async function translateBatch(models) {
  const prompt = `Translate the following vehicle model names into German (de), English (en), French (fr), Dutch (nl), and Russian (ru).

Models:
${models.map(m => `- ${m.make_name} ${m.model_name}`).join('\n')}

Respond with ONLY a JSON array (no markdown), one object per model:
[
  {
    "model": "Model Name",
    "translations": {
      "de": "German name",
      "en": "English name",
      "fr": "French name",
      "nl": "Dutch name",
      "ru": "Russian name"
    }
  }
]

Use the original model name if translation is not applicable (e.g., "BMW 3 Series" stays the same in all languages).`;

  const response = await callGoogleAI(prompt);
  return JSON.parse(response);
}

async function main() {
  await client.connect();

  console.log('🔍 Поиск моделей без переводов...\n');

  const modelsWithoutTranslations = await client.query(`
    select mk.name_en as make_name, m.slug, m.name_en as model_name, m.id
    from vehicle_models m
    join vehicle_makes mk on mk.id = m.make_id
    left join vehicle_model_i18n i on i.model_id = m.id
    group by mk.name_en, m.slug, m.name_en, m.id
    having count(i.model_id) < 5
    order by mk.name_en, m.name_en
  `);

  console.log(`📊 Найдено моделей: ${modelsWithoutTranslations.rowCount}\n`);

  if (modelsWithoutTranslations.rowCount === 0) {
    console.log('✅ Все модели имеют переводы!');
    await client.end();
    return;
  }

  const batches = [];
  for (let i = 0; i < modelsWithoutTranslations.rows.length; i += BATCH_SIZE) {
    batches.push(modelsWithoutTranslations.rows.slice(i, i + BATCH_SIZE));
  }

  console.log(`📦 Обработка ${batches.length} батчей по ${BATCH_SIZE} моделей...\n`);

  let processed = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`📦 Batch ${i + 1}/${batches.length} (${batch.length} моделей)...`);

    try {
      const translations = await translateBatch(batch);

      for (const translation of translations) {
        const model = batch.find(m => 
          m.model_name.toLowerCase().includes(translation.model.toLowerCase()) ||
          translation.model.toLowerCase().includes(m.model_name.toLowerCase())
        );
        
        if (!model) {
          console.log(`   ⚠️  Не найдена модель для: ${translation.model}`);
          continue;
        }

        // Insert translations for all languages
        for (const locale of LANGUAGES) {
          const transName = translation.translations[locale];
          if (!transName) continue;

          await client.query(`
            insert into vehicle_model_i18n (model_id, locale, name)
            values ($1, $2, $3)
            on conflict (model_id, locale) do update set
              name = EXCLUDED.name
          `, [model.id, locale, transName || model.model_name]);
        }

        processed++;
      }

      console.log(`   ✅ Обработано: ${translations.length} моделей`);
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (err) {
      console.error(`   ❌ Ошибка batch ${i + 1}:`, err.message);
    }
  }

  console.log(`\n✅ Завершено! Переведено моделей: ${processed}`);
  await client.end();
}

main().catch(err => {
  console.error('❌ Критическая ошибка:', err);
  process.exit(1);
});

