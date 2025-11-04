import fs from 'fs';

// Read JSON
const data = JSON.parse(fs.readFileSync('seed/vehicles_full_enriched2.json', 'utf8'));

// Find BMW
const bmw = data.makes.find(m => 
  m.slug === 'bmw' || 
  m.name_en?.toLowerCase() === 'bmw'
);

if (!bmw) {
  console.log('❌ BMW не найден в JSON');
  process.exit(1);
}

console.log('📋 BMW модели из vehicles_full_enriched2.json:\n');

console.log('=== ВСЕ МОДЕЛИ (включая < 1980) ===');
console.log(`Всего в JSON: ${bmw.models.length}\n`);

bmw.models.forEach((m, idx) => {
  const years = `${m.first_model_year || '?'}-${m.last_model_year || 'now'}`;
  console.log(`${idx + 1}. ${m.name_en || m.slug} (${years})`);
});

// Filter models >= 1980
const models = bmw.models.filter(m => {
  if (!m) return false;
  
  // Check first_model_year
  if (m.first_model_year && m.first_model_year >= 1980) return true;
  
  // Check last_model_year
  if (m.last_model_year && m.last_model_year >= 1980) return true;
  
  // Check years_available
  if (Array.isArray(m.years_available) && m.years_available.length > 0) {
    const hasValidYear = m.years_available.some(year => year >= 1980);
    if (hasValidYear) return true;
  }
  
  return false;
});

console.log(`\n=== МОДЕЛИ >= 1980 ===`);
console.log(`Всего моделей (>= 1980): ${models.length}\n`);

models.forEach((m, idx) => {
  const years = `${m.first_model_year || '?'}-${m.last_model_year || 'now'}`;
  console.log(`${idx + 1}. ${m.name_en || m.slug} (${years})`);
});

console.log(`\n✅ Всего: ${models.length} моделей BMW >= 1980`);

