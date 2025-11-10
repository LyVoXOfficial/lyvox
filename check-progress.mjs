import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    await client.connect();
    
    console.log("\n╔══════════════════════════════════════════════════════════════════╗");
    console.log("║  📊 ПРОГРЕСС ГЕНЕРАЦИИ И ПЕРЕВОДОВ                             ║");
    console.log("╚══════════════════════════════════════════════════════════════════╝\n");
    
    // 1. Всего поколений
    const { rows: [totalGen] } = await client.query(`
      SELECT COUNT(*) as total 
      FROM vehicle_generations 
      WHERE code IS NOT NULL AND code != ''
    `);
    
    console.log(`📌 Всего поколений в БД: ${totalGen.total}\n`);
    
    // 2. Сгенерировано insights
    const { rows: [generated] } = await client.query(`
      SELECT COUNT(*) as total 
      FROM vehicle_generation_insights
    `);
    
    const genPercent = Math.round((generated.total / totalGen.total) * 100);
    console.log(`🔄 ГЕНЕРАЦИЯ INSIGHTS:`);
    console.log(`   Готово: ${generated.total} / ${totalGen.total} (${genPercent}%)`);
    console.log(`   Осталось: ${totalGen.total - generated.total}\n`);
    
    // 3. Переводы по языкам
    const locales = ['en', 'fr', 'nl', 'de'];
    const targetPerLocale = generated.total; // Для каждого insight нужен перевод на каждый язык
    const totalTarget = targetPerLocale * locales.length;
    
    console.log(`🌐 ПЕРЕВОДЫ (нужно ${locales.length} языка для каждого insight):\n`);
    
    let totalTranslated = 0;
    
    for (const locale of locales) {
      const { rows: [translated] } = await client.query(`
        SELECT COUNT(*) as total 
        FROM vehicle_generation_insights_i18n 
        WHERE locale = $1
      `, [locale]);
      
      const percent = Math.round((translated.total / targetPerLocale) * 100);
      const localeName = {en: 'English', fr: 'French', nl: 'Dutch', de: 'German'}[locale];
      
      console.log(`   [${locale}] ${localeName}:`);
      console.log(`      Готово: ${translated.total} / ${targetPerLocale} (${percent}%)`);
      console.log(`      Осталось: ${targetPerLocale - translated.total}\n`);
      
      totalTranslated += parseInt(translated.total);
    }
    
    const totalPercent = Math.round((totalTranslated / totalTarget) * 100);
    
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 ИТОГО ПЕРЕВОДОВ:`);
    console.log(`   Готово: ${totalTranslated} / ${totalTarget} (${totalPercent}%)`);
    console.log(`   Осталось: ${totalTarget - totalTranslated}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    // 4. Оценка времени
    if (totalTranslated > 0 && totalTranslated < totalTarget) {
      // Предполагаем 1.5 сек на перевод
      const remaining = totalTarget - totalTranslated;
      const seconds = remaining * 1.5;
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      
      console.log(`⏰ Примерное время до завершения:`);
      console.log(`   ~${hours} часов ${minutes} минут\n`);
    }
    
    // 5. Последние переведенные
    const { rows: recent } = await client.query(`
      SELECT 
        vgi18n.locale,
        vg.code,
        vm.name_en as model_name,
        vmk.name_en as make_name,
        vgi18n.created_at
      FROM vehicle_generation_insights_i18n vgi18n
      JOIN vehicle_generation_insights vgi ON vgi.generation_id = vgi18n.generation_id
      JOIN vehicle_generations vg ON vg.id = vgi18n.generation_id
      JOIN vehicle_models vm ON vm.id = vg.model_id
      JOIN vehicle_makes vmk ON vmk.id = vm.make_id
      ORDER BY vgi18n.created_at DESC
      LIMIT 5
    `);
    
    if (recent.length > 0) {
      console.log(`📝 Последние переведенные (5 штук):\n`);
      recent.forEach((r, i) => {
        const time = new Date(r.created_at).toLocaleTimeString('ru-RU');
        console.log(`   ${i+1}. [${r.locale}] ${r.make_name} ${r.model_name} ${r.code} - ${time}`);
      });
      console.log('');
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await client.end();
  }
}

main();








