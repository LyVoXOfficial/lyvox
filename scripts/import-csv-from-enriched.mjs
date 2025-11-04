#!/usr/bin/env node
/**
 * Импорт из CSV используя существующие enriched данные
 * Вместо AI обогащения используем vehicles_full_enriched2.json
 * 
 * Использование:
 *   node scripts/import-csv-from-enriched.mjs
 *   MAKE="BMW" node scripts/import-csv-from-enriched.mjs
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';

const MAKE = process.env.MAKE || '';

console.log('📄 Загрузка enriched JSON...\n');
const enrichedData = JSON.parse(fs.readFileSync('seed/vehicles_full_enriched2.json', 'utf8'));

console.log('📄 Загрузка CSV...\n');
const csvContent = fs.readFileSync('seed/transport_make_model.csv', 'utf8');
const records = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
  trim: true
});

console.log(`✅ Enriched: ${enrichedData.makes.length} марок`);
console.log(`✅ CSV: ${records.length} моделей\n`);

// Build lookup tables
const enrichedByMake = {};
for (const make of enrichedData.makes) {
  const key = make.slug || make.name_en?.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  enrichedByMake[key] = make;
}

// Group CSV by make
const csvByMake = {};
for (const row of records) {
  const make = row.Make;
  if (!make) continue;
  if (MAKE && make.toLowerCase() !== MAKE.toLowerCase()) continue;
  
  if (!csvByMake[make]) {
    csvByMake[make] = [];
  }
  csvByMake[make].push({
    name: row.Model,
    year_start: parseInt(row.Year_Start) || null,
    year_end: row.Year_End ? parseInt(row.Year_End) : null,
    body_type: row.Body_Type || '',
    country: row.Country || ''
  });
}

const makesToProcess = Object.keys(csvByMake);
console.log(`🔍 Обрабатываем марок: ${makesToProcess.length}\n`);

if (MAKE) {
  console.log(`   Фильтр: ${MAKE}\n`);
}

const results = [];
let totalModelsAdded = 0;
let totalModelsMatched = 0;

for (const makeName of makesToProcess) {
  const makeSlug = makeName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const csvModels = csvByMake[makeName];
  
  console.log(`${'='.repeat(60)}`);
  console.log(`🚗 ${makeName} (${csvModels.length} моделей в CSV)`);
  console.log(`${'='.repeat(60)}`);
  
  // Try to find enriched data for this make
  const enrichedMake = enrichedByMake[makeSlug];
  
  if (!enrichedMake) {
    console.log(`   ⚠️  Не найдено в enriched JSON`);
    
    // Create basic make data
    results.push({
      slug: makeSlug,
      name_en: makeName,
      country: csvModels[0].country || 'Unknown',
      segment_class: null,
      is_active: true,
      category_path: 'transport/legkovye-avtomobili',
      models: csvModels.map(m => ({
        slug: m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name_en: m.name,
        name_ru: m.name,
        first_model_year: m.year_start,
        last_model_year: m.year_end || 2024,
        years_available: [],
        body_types_available: m.body_type ? [m.body_type] : [],
        fuel_types_available: [],
        transmission_available: [],
        reliability_score: null,
        popularity_score: null,
        generations: [],
        insight: null
      }))
    });
    totalModelsAdded += csvModels.length;
    continue;
  }
  
  console.log(`   ✅ Найдено в enriched JSON (${enrichedMake.models?.length || 0} моделей)`);
  
  // Match CSV models with enriched models
  const matchedModels = [];
  
  for (const csvModel of csvModels) {
    const modelSlug = csvModel.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // Try to find matching enriched model
    const enrichedModel = enrichedMake.models?.find(m => {
      const mSlug = m.slug || m.name_en?.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      return mSlug === modelSlug || 
             m.name_en?.toLowerCase() === csvModel.name.toLowerCase() ||
             m.name_ru?.toLowerCase() === csvModel.name.toLowerCase();
    });
    
    if (enrichedModel) {
      matchedModels.push(enrichedModel);
      totalModelsMatched++;
      console.log(`   ✅ ${csvModel.name} → matched`);
    } else {
      // Create basic model
      matchedModels.push({
        slug: modelSlug,
        name_en: csvModel.name,
        name_ru: csvModel.name,
        first_model_year: csvModel.year_start,
        last_model_year: csvModel.year_end || 2024,
        years_available: [],
        body_types_available: csvModel.body_type ? [csvModel.body_type] : [],
        fuel_types_available: [],
        transmission_available: [],
        reliability_score: null,
        popularity_score: null,
        generations: [],
        insight: null
      });
      totalModelsAdded++;
      console.log(`   ⚠️  ${csvModel.name} → no match (basic data)`);
    }
  }
  
  results.push({
    ...enrichedMake,
    slug: makeSlug,
    name_en: makeName,
    models: matchedModels
  });
  
  console.log(`\n   📊 ${makeName}: ${matchedModels.length} моделей готово`);
}

// Save
const output = { makes: results };
const outputPath = 'seed/vehicles_from_csv_enriched.json';
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

console.log(`\n${'='.repeat(60)}`);
console.log('🎉 ЗАВЕРШЕНО!');
console.log(`${'='.repeat(60)}`);
console.log(`\nФайл: ${outputPath}`);
console.log(`Марок: ${results.length}`);
console.log(`Моделей matched (enriched): ${totalModelsMatched}`);
console.log(`Моделей added (basic): ${totalModelsAdded}`);
console.log(`\nСледующие шаги:`);
console.log(`  INPUT_JSON="seed/vehicles_from_csv_enriched.json" node scripts/generateVehicleSeed.mjs`);
console.log(`  DATABASE_URL="..." node scripts/runSeed.mjs ./vehicles_seed.sql`);

