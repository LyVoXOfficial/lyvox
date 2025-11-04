import { Client } from 'pg';

const DB_URL = process.env.DATABASE_URL;
const client = new Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }
});

await client.connect();

// Find BMW
const bmwResult = await client.query(`
  SELECT id, slug, name_en 
  FROM vehicle_makes 
  WHERE slug = 'bmw' OR LOWER(name_en) = 'bmw'
`);

if (bmwResult.rows.length === 0) {
  console.log('❌ BMW не найден в БД');
  await client.end();
  process.exit(1);
}

const bmw = bmwResult.rows[0];
console.log(`✅ Найдена марка: ${bmw.name_en} (${bmw.slug})\n`);

// Get models
const modelsResult = await client.query(`
  SELECT 
    vm.slug, 
    vm.name_en, 
    vm.first_model_year, 
    vm.last_model_year,
    vm.years_available,
    array_agg(vmi.name) FILTER (WHERE vmi.locale = 'ru') as name_ru
  FROM vehicle_models vm
  LEFT JOIN vehicle_model_i18n vmi ON vmi.model_id = vm.id
  WHERE vm.make_id = $1
  GROUP BY vm.id, vm.slug, vm.name_en, vm.first_model_year, vm.last_model_year, vm.years_available
  ORDER BY vm.name_en
`, [bmw.id]);

console.log(`📋 BMW модели в базе данных:\n`);
console.log(`Всего моделей: ${modelsResult.rows.length}\n`);

modelsResult.rows.forEach((m, idx) => {
  const years = `${m.first_model_year || '?'}-${m.last_model_year || 'now'}`;
  const ruName = m.name_ru && m.name_ru[0] ? ` [RU: ${m.name_ru[0]}]` : '';
  console.log(`${idx + 1}. ${m.name_en} (${years})${ruName}`);
});

console.log(`\n✅ Всего: ${modelsResult.rows.length} моделей BMW в БД`);

await client.end();

