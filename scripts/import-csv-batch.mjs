#!/usr/bin/env node
/**
 * BATCH импорт из CSV - обрабатывает несколько моделей за один AI запрос
 * Намного быстрее и дешевле чем import-from-csv.mjs
 * 
 * Использование:
 *   GOOGLE_API_KEY="..." node scripts/import-csv-batch.mjs
 *   GOOGLE_API_KEY="..." MAKE="BMW" node scripts/import-csv-batch.mjs
 *   GOOGLE_API_KEY="..." BATCH_SIZE=5 node scripts/import-csv-batch.mjs
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const GOOGLE_MODEL = process.env.GOOGLE_MODEL || 'gemini-2.0-flash-exp';
const MAKE = process.env.MAKE || '';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '10', 10);

if (!GOOGLE_API_KEY) {
  console.error('❌ GOOGLE_API_KEY required');
  process.exit(1);
}

async function callGoogleAI(prompt) {
  // Правильные названия моделей из Google AI Studio
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

// Load and parse CSV
console.log('📄 Загрузка CSV...\n');
const csvContent = fs.readFileSync('seed/transport_make_model.csv', 'utf8');
const records = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
  trim: true
});

// Group by make
const makeGroups = {};
for (const row of records) {
  const make = row.Make;
  if (!make) continue;
  if (MAKE && make.toLowerCase() !== MAKE.toLowerCase()) continue;
  
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

const makesToProcess = Object.keys(makeGroups);
console.log(`✅ Найдено марок: ${makesToProcess.length}`);
if (MAKE) console.log(`   Обрабатываем только: ${MAKE}\n`);

// Process each make
const enrichedMakes = [];
let totalProcessed = 0;

for (const makeName of makesToProcess) {
  const makeData = makeGroups[makeName];
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚗 ${makeName} (${makeData.models.length} моделей)`);
  console.log(`${'='.repeat(60)}`);
  
  const enrichedModels = [];
  
  // Process in batches
  for (let i = 0; i < makeData.models.length; i += BATCH_SIZE) {
    const batch = makeData.models.slice(i, i + BATCH_SIZE);
    console.log(`\n   Batch ${Math.floor(i / BATCH_SIZE) + 1}: обработка ${batch.length} моделей...`);
    
    try {
      const prompt = `You are an automotive data expert. For the following ${batch.length} car models from ${makeName}, generate comprehensive data.

Models to process:
${batch.map((m, idx) => `${idx + 1}. ${m.name} (${m.year_start}-${m.year_end || 'current'})`).join('\n')}

Generate a JSON array with this EXACT structure for each model:

[
  {
    "slug": "model-name-lowercase-dasherized",
    "name_en": "Official Model Name",
    "name_ru": "Название на русском",
    "first_model_year": 2000,
    "last_model_year": 2024,
    "years_available": [2000, 2005, 2010, 2015, 2020, 2024],
    "body_types_available": ["Sedan", "Wagon"],
    "fuel_types_available": ["Gasoline", "Diesel"],
    "transmission_available": ["Manual", "Automatic"],
    "reliability_score": 7.5,
    "popularity_score": 8.0,
    "generations": [
      {
        "code": "Generation I (1990-1995)",
        "start_year": 1990,
        "end_year": 1995,
        "facelift": false,
        "production_countries": ["Germany"],
        "body_types": [],
        "fuel_types": [],
        "transmission_types": [],
        "summary": "First generation description"
      }
    ],
    "insight": {
      "pros": ["Reliable engine", "Good fuel economy"],
      "cons": ["Expensive maintenance", "Poor interior"],
      "inspection_tips": ["Check rust", "Test transmission"],
      "notable_features": ["AWD system", "Turbo engine"],
      "engine_examples": ["2.0L I4", "3.0L V6"],
      "common_issues_by_engine": [
        {
          "engine_code": "M50B25",
          "common_issues_ru": ["Утечка масла", "Износ цепи ГРМ"]
        }
      ]
    }
  }
]

IMPORTANT:
- Generate for ALL ${batch.length} models
- Use REAL automotive data, not placeholders
- name_ru must be in Russian
- common_issues_ru must be in Russian
- reliability_score and popularity_score: 0-10 scale
- Respond with ONLY the JSON array`;

      const response = await callGoogleAI(prompt);
      const batchData = JSON.parse(response);
      
      if (!Array.isArray(batchData)) {
        throw new Error('Response is not an array');
      }
      
      enrichedModels.push(...batchData);
      console.log(`   ✅ Обработано: ${batchData.length} моделей`);
      totalProcessed += batchData.length;
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (err) {
      console.error(`   ❌ Ошибка batch:`, err.message);
      // Fallback: add basic data
      for (const model of batch) {
        enrichedModels.push({
          slug: model.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          name_en: model.name,
          name_ru: model.name,
          first_model_year: model.year_start,
          last_model_year: model.year_end || 2024,
          years_available: [],
          body_types_available: [],
          fuel_types_available: [],
          transmission_available: [],
          reliability_score: null,
          popularity_score: null,
          generations: [],
          insight: null
        });
      }
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
  
  console.log(`   ✅ ${makeName}: ${enrichedModels.length} моделей завершено`);
}

// Save
const output = { makes: enrichedMakes };
const outputPath = 'seed/vehicles_from_csv_enriched.json';
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

console.log(`\n${'='.repeat(60)}`);
console.log('🎉 ЗАВЕРШЕНО!');
console.log(`${'='.repeat(60)}`);
console.log(`\nФайл: ${outputPath}`);
console.log(`Марок: ${enrichedMakes.length}`);
console.log(`Моделей: ${totalProcessed}`);
console.log(`\nСледующие шаги:`);
console.log(`  node scripts/generateVehicleSeed.mjs`);
console.log(`  node scripts/runSeed.mjs ./vehicles_seed.sql`);

