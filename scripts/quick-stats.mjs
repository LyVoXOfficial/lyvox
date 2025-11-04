import { Client } from 'pg';

const DB_URL = process.env.DATABASE_URL;
const client = new Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }
});

await client.connect();

const makes = await client.query(`SELECT COUNT(*) as count FROM vehicle_makes`);
const models = await client.query(`SELECT COUNT(*) as count FROM vehicle_models`);
const generations = await client.query(`SELECT COUNT(*) as count FROM vehicle_generations`);
const insights = await client.query(`SELECT COUNT(*) as count FROM vehicle_insights`);

console.log('📊 Статистика БД после загрузки:');
console.log(`   Марок:      ${makes.rows[0].count}`);
console.log(`   Моделей:    ${models.rows[0].count}`);
console.log(`   Поколений:  ${generations.rows[0].count}`);
console.log(`   Insights:   ${insights.rows[0].count}`);

// Переводы
const makeI18n = await client.query(`SELECT locale, COUNT(*) as count FROM vehicle_make_i18n GROUP BY locale ORDER BY locale`);
const modelI18n = await client.query(`SELECT locale, COUNT(*) as count FROM vehicle_model_i18n GROUP BY locale ORDER BY locale`);

console.log('\n📊 Переводы марок:');
makeI18n.rows.forEach(r => console.log(`   ${r.locale}: ${r.count}`));

console.log('\n📊 Переводы моделей:');
modelI18n.rows.forEach(r => console.log(`   ${r.locale}: ${r.count}`));

await client.end();

