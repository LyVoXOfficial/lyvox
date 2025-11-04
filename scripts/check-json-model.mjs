#!/usr/bin/env node
import fs from 'fs';

const [,, makeSlug, modelSlug] = process.argv;

if (!makeSlug || !modelSlug) {
  console.error('Usage: node scripts/check-json-model.mjs <make-slug> <model-slug>');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync('seed/vehicles_from_csv_enriched.json', 'utf8'));
const make = data.makes.find(m => m.slug === makeSlug);

if (!make) {
  console.error(`Make ${makeSlug} not found`);
  process.exit(1);
}

const model = make.models.find(m => m.slug === modelSlug);

if (!model) {
  console.error(`Model ${modelSlug} not found under ${makeSlug}`);
  process.exit(1);
}

console.log(JSON.stringify(model, null, 2));


