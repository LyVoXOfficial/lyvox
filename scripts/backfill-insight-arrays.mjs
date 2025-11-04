#!/usr/bin/env node
/**
 * Заполнение пустых массивов в существующих insights
 */
import pg from 'pg';
import fs from 'fs';

const DATABASE_URL = process.env.DATABASE_URL;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
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

const arrayColumns = [
  'pros',
  'cons',
  'inspection_tips',
  'notable_features',
  'engine_examples',
  'common_issues_by_engine'
];

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

async function fillMissingFields(make, model, missingFields) {
  const fieldDescriptions = {
    pros: 'advantages/strengths (3-5 items)',
    cons: 'disadvantages/weaknesses (3-5 items)',
    inspection_tips: 'tips for buyers inspecting used vehicles (3-5 items)',
    notable_features: 'notable/standout features (2-4 items)',
    engine_examples: 'common engine codes or descriptions (2-4 items)',
    common_issues_by_engine: 'array of objects with engine_code and common_issues_ru in Russian (1-3 items)'
  };

  const fieldsStr = missingFields.map(f => `- ${f}: ${fieldDescriptions[f]}`).join('\n');

  const prompt = `You are an automotive expert. For ${make} ${model}, provide ONLY the following missing fields:

${fieldsStr}

Respond with ONLY a JSON object (no markdown):

{
  ${missingFields.map(f => {
    if (f === 'common_issues_by_engine') {
      return `"${f}": [{"engine_code": "example", "common_issues_ru": ["issue1", "issue2"]}]`;
    }
    return `"${f}": ["item1", "item2", "item3"]`;
  }).join(',\n  ')}
}`;

  const response = await callGoogleAI(prompt);
  return JSON.parse(response);
}

async function main() {
  await client.connect();

  if (!fs.existsSync('audit-report.json')) {
    console.error('❌ audit-report.json не найден. Запустите сначала audit-full-coverage.mjs');
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync('audit-report.json', 'utf8'));
  const emptyArrays = report.issues.empty_arrays;

  console.log('📊 Найдено пустых массивов:');
  let totalToFix = 0;
  for (const [column, rows] of Object.entries(emptyArrays)) {
    console.log(`  ${column}: ${rows.length} моделей`);
    totalToFix += rows.length;
  }

  if (totalToFix === 0) {
    console.log('✅ Нет пустых массивов!');
    await client.end();
    return;
  }

  if (DRY_RUN) {
    console.log('\n🔍 DRY_RUN режим - показываю что будет обработано:');
    for (const [column, rows] of Object.entries(emptyArrays)) {
      console.log(`\n${column}:`);
      rows.slice(0, 5).forEach(m => {
        console.log(`  ${m.make_slug} / ${m.model_slug} (${m.name_en})`);
      });
      if (rows.length > 5) {
        console.log(`  ... и ещё ${rows.length - 5}`);
      }
    }
    await client.end();
    return;
  }

  // Группируем по модели
  const modelToFields = new Map();
  for (const [column, rows] of Object.entries(emptyArrays)) {
    for (const row of rows) {
      const key = `${row.make_slug}::${row.model_slug}`;
      if (!modelToFields.has(key)) {
        modelToFields.set(key, { make: row.make_slug, model: row.name_en, slug: row.model_slug, fields: [] });
      }
      modelToFields.get(key).fields.push(column);
    }
  }

  console.log(`\n📦 Обработка ${modelToFields.size} моделей...`);

  let processed = 0;
  for (const [key, data] of modelToFields.entries()) {
    console.log(`\n🔧 ${data.make} / ${data.model} (${data.fields.join(', ')})...`);

    try {
      const filled = await fillMissingFields(data.make, data.model, data.fields);

      const updates = [];
      const values = [];
      let idx = 1;

      for (const field of data.fields) {
        if (filled[field] && Array.isArray(filled[field]) && filled[field].length > 0) {
          updates.push(`${field} = $${idx}::jsonb`);
          values.push(JSON.stringify(filled[field]));
          idx++;
        }
      }

      if (updates.length > 0) {
        values.push(data.slug);
        await client.query(`
          update vehicle_insights i
          set ${updates.join(', ')}
          from vehicle_models m
          where m.id = i.model_id and m.slug = $${idx}
        `, values);
        processed++;
        console.log('   ✅ Обновлено');
      }

      await new Promise(resolve => setTimeout(resolve, 1500));

    } catch (err) {
      console.error(`   ❌ Ошибка:`, err.message);
    }
  }

  console.log(`\n✅ Завершено! Обновлено моделей: ${processed}`);
  await client.end();
}

main().catch(err => {
  console.error('❌ Ошибка:', err);
  process.exit(1);
});

