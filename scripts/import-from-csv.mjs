#!/usr/bin/env node
/**
 * Импорт и обогащение данных из transport_make_model.csv
 * 
 * Процесс:
 * 1. Парсинг CSV
 * 2. Обогащение через AI (поколения, характеристики, insights)
 * 3. Автоматические переводы (EN, RU, NL, FR, DE)
 * 4. Генерация enriched JSON
 * 
 * Требования:
 * - OPENAI_API_KEY или GOOGLE_API_KEY
 * 
 * Использование:
 *   GOOGLE_API_KEY="..." node scripts/import-from-csv.mjs
 *   GOOGLE_API_KEY="..." ONLY_MAKES="BMW,Audi" node scripts/import-from-csv.mjs
 *   GOOGLE_API_KEY="..." LIMIT=50 node scripts/import-from-csv.mjs
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
const GOOGLE_MODEL = process.env.GOOGLE_MODEL || 'gemini-2.0-flash-exp';
const DRY_RUN = /^true$/i.test(process.env.DRY_RUN || '');
const ONLY_MAKES = (process.env.ONLY_MAKES || '').split(',').map(m => m.trim().toLowerCase()).filter(Boolean);
const LIMIT = parseInt(process.env.LIMIT || '0', 10);

// Helpers
function stripBoilerplate(input) {
  let text = (input ?? '').toString();
  if (!text) return '';
  text = text.replace(/```[\s\S]*?```/g, '').replace(/```/g, '');
  text = text.replace(/^\s*[*_`]+/, '').replace(/[*_`]+\s*$/g, '');
  text = text.replace(/^\s*['"""`]+/, '').replace(/['"""`]+\s*$/g, '');
  const headers = [
    'here is the translation', "here's the translation", 'translation', 
    'voici la traduction', 'hier ist die übersetzung', 'hier is de vertaling'
  ];
  for (const header of headers) {
    const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp('^\\s*' + escaped + '[:\\-]?\\s*', 'i');
    if (pattern.test(text)) {
      text = text.replace(pattern, '');
      break;
    }
  }
  return text.trim();
}

async function callAI(prompt, isJSON = false) {
  const systemPrompt = isJSON 
    ? 'You are a technical automotive data expert. Respond ONLY with valid JSON, no markdown, no explanations.'
    : 'You are a technical automotive expert. Provide accurate, concise information.';

  if (GOOGLE_API_KEY) {
    const models = [GOOGLE_MODEL, 'gemini-2.0-flash-001', 'gemini-1.5-flash-latest'];
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GOOGLE_API_KEY)}`;
        const body = {
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }],
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
        const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
        return isJSON ? text : stripBoilerplate(text);
      } catch (err) {
        console.error(`Google AI error (${model}):`, err.message);
      }
    }
  }

  if (OPENAI_API_KEY) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${OPENAI_API_KEY}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          response_format: isJSON ? { type: 'json_object' } : undefined
        })
      });
      if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      return isJSON ? text : stripBoilerplate(text);
    } catch (err) {
      console.error('OpenAI error:', err.message);
    }
  }

  throw new Error('No AI API available (set GOOGLE_API_KEY or OPENAI_API_KEY)');
}

// Parse CSV
console.log('📄 Парсинг CSV файла...\n');
const csvContent = fs.readFileSync('seed/transport_make_model.csv', 'utf8');
const records = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
  trim: true
});

console.log(`✅ Загружено ${records.length} записей из CSV\n`);

// Group by make
const makeGroups = {};
for (const row of records) {
  const make = row.Make;
  if (!make) continue;
  if (!makeGroups[make]) {
    makeGroups[make] = {
      name: make,
      country: row.Country || 'Unknown',
      models: []
    };
  }
  makeGroups[make].models.push({
    name: row.Model,
    year_start: parseInt(row.Year_Start) || null,
    year_end: row.Year_End ? parseInt(row.Year_End) : null,
    body_type: row.Body_Type || ''
  });
}

console.log(`📊 Найдено ${Object.keys(makeGroups).length} уникальных марок\n`);

// Filter if needed
let makesToProcess = Object.keys(makeGroups);
if (ONLY_MAKES.length > 0) {
  makesToProcess = makesToProcess.filter(m => ONLY_MAKES.includes(m.toLowerCase()));
  console.log(`🔍 Фильтр: обрабатываем только ${makesToProcess.join(', ')}\n`);
}
if (LIMIT > 0) {
  makesToProcess = makesToProcess.slice(0, LIMIT);
  console.log(`🔍 Лимит: обрабатываем первые ${LIMIT} марок\n`);
}

// Enrich data
const enrichedMakes = [];
let processedCount = 0;

for (const makeName of makesToProcess) {
  const makeData = makeGroups[makeName];
  processedCount++;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${processedCount}/${makesToProcess.length}] 🚗 Обрабатываем: ${makeName}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`   Страна: ${makeData.country}`);
  console.log(`   Моделей: ${makeData.models.length}`);
  
  if (DRY_RUN) {
    console.log('   ⏭️  DRY RUN - пропускаем обогащение');
    continue;
  }

  const enrichedModels = [];
  
  for (let i = 0; i < makeData.models.length; i++) {
    const model = makeData.models[i];
    console.log(`\n   [${i + 1}/${makeData.models.length}] Модель: ${model.name} (${model.year_start}-${model.year_end || 'now'})`);
    
    try {
      // Get detailed info via AI
      const prompt = `
For the car: ${makeName} ${model.name} (${model.year_start}-${model.year_end || 'current'})

Generate a JSON object with the following structure:
{
  "slug": "model-slug-lowercase-dasherized",
  "name_en": "Model Name",
  "name_ru": "Название модели на русском",
  "first_model_year": ${model.year_start || 'null'},
  "last_model_year": ${model.year_end || 2024},
  "years_available": [list of years from start to end, sample max 10 years],
  "body_types_available": ["sedan", "coupe", etc],
  "fuel_types_available": ["Gasoline", "Diesel", "Electric", "Hybrid"],
  "transmission_available": ["Manual", "Automatic", "CVT"],
  "reliability_score": 0-10,
  "popularity_score": 0-10,
  "generations": [
    {
      "code": "Generation I (E36)",
      "start_year": 1990,
      "end_year": 1998,
      "facelift": false,
      "production_countries": ["Germany"],
      "summary": "Brief description in English"
    }
  ],
  "insight": {
    "pros": ["advantage 1", "advantage 2"],
    "cons": ["disadvantage 1", "disadvantage 2"],
    "inspection_tips": ["tip 1", "tip 2"],
    "notable_features": ["feature 1", "feature 2"],
    "engine_examples": ["2.0L I4", "3.0L V6"],
    "common_issues_by_engine": [
      {
        "engine_code": "M50B25",
        "common_issues_ru": ["проблема 1", "проблема 2"]
      }
    ]
  }
}

Respond with ONLY the JSON object, no markdown.`;

      const response = await callAI(prompt, true);
      const modelData = JSON.parse(response);
      
      enrichedModels.push(modelData);
      console.log(`      ✅ Обогащено (поколений: ${modelData.generations?.length || 0})`);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (err) {
      console.error(`      ❌ Ошибка:`, err.message);
      // Add basic model data as fallback
      enrichedModels.push({
        slug: model.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name_en: model.name,
        name_ru: model.name,
        first_model_year: model.year_start,
        last_model_year: model.year_end || 2024,
        years_available: [],
        body_types_available: model.body_type ? [model.body_type] : [],
        fuel_types_available: [],
        transmission_available: [],
        reliability_score: null,
        popularity_score: null,
        generations: [],
        insight: null
      });
    }
  }
  
  enrichedMakes.push({
    slug: makeName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name_en: makeName,
    country: makeData.country,
    segment_class: null,
    is_active: true,
    category_path: 'transport/legkovye-avtomobili',
    models: enrichedModels
  });
  
  console.log(`\n   ✅ ${makeName} завершён: ${enrichedModels.length} моделей обогащено`);
}

// Save result
const output = { makes: enrichedMakes };
const outputPath = 'seed/vehicles_from_csv_enriched.json';
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

console.log(`\n${'='.repeat(60)}`);
console.log('✅ ЗАВЕРШЕНО!');
console.log(`${'='.repeat(60)}`);
console.log(`\nФайл сохранён: ${outputPath}`);
console.log(`\nСтатистика:`);
console.log(`  Обработано марок: ${enrichedMakes.length}`);
console.log(`  Всего моделей: ${enrichedMakes.reduce((sum, m) => sum + m.models.length, 0)}`);
console.log(`\nСледующий шаг:`);
console.log(`  1. Проверьте файл: ${outputPath}`);
console.log(`  2. Запустите генератор: node scripts/generateVehicleSeed.mjs`);
console.log(`  3. Примените к БД: node scripts/runSeed.mjs ./vehicles_seed.sql`);

