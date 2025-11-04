import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function checkProgress() {
  try {
    await client.connect();
    
    console.log("\n" + "=".repeat(60));
    console.log("📊 GENERATION INSIGHTS PROGRESS CHECK");
    console.log("⏰ Time:", new Date().toLocaleString('ru-RU'));
    console.log("=".repeat(60) + "\n");

    // 1. Total generations to process
    const { rows: [totalGen] } = await client.query(`
      SELECT COUNT(*) as count 
      FROM vehicle_generations 
      WHERE code IS NOT NULL AND code != ''
    `);
    console.log(`🎯 TOTAL GENERATIONS: ${totalGen.count}`);

    // 2. Created insights (Russian)
    const { rows: [createdInsights] } = await client.query(`
      SELECT COUNT(*) as count 
      FROM vehicle_generation_insights
    `);
    const insightsPercent = ((createdInsights.count / totalGen.count) * 100).toFixed(1);
    console.log(`✅ INSIGHTS CREATED: ${createdInsights.count}/${totalGen.count} (${insightsPercent}%)`);

    // 3. Translations by locale
    const { rows: translations } = await client.query(`
      SELECT locale, COUNT(*) as count 
      FROM vehicle_generation_insights_i18n 
      GROUP BY locale 
      ORDER BY locale
    `);
    
    console.log(`\n🌐 TRANSLATIONS:`);
    const locales = ['en', 'fr', 'nl', 'de'];
    locales.forEach(locale => {
      const trans = translations.find(t => t.locale === locale);
      const count = trans ? trans.count : 0;
      const percent = ((count / createdInsights.count) * 100).toFixed(1);
      const emoji = count === parseInt(createdInsights.count) ? '✅' : '⏳';
      console.log(`  ${emoji} ${locale.toUpperCase()}: ${count}/${createdInsights.count} (${percent}%)`);
    });

    // 4. Missing insights
    const { rows: missing } = await client.query(`
      SELECT 
        vg.id as generation_id,
        vmk.name as make_name,
        vm.name_en as model_name,
        vg.code,
        vg.start_year,
        vg.end_year
      FROM vehicle_generations vg
      JOIN vehicle_models vm ON vm.id = vg.model_id
      JOIN vehicle_makes vmk ON vmk.id = vm.make_id
      LEFT JOIN vehicle_generation_insights vgi ON vgi.generation_id = vg.id
      WHERE vg.code IS NOT NULL 
        AND vg.code != ''
        AND vgi.generation_id IS NULL
      ORDER BY vmk.name, vm.name_en, vg.start_year
      LIMIT 10
    `);

    if (missing.length > 0) {
      console.log(`\n⚠️  MISSING INSIGHTS (showing first 10):`);
      missing.forEach(m => {
        console.log(`   - ${m.make_name} ${m.model_name} ${m.code} (${m.start_year}-${m.end_year || 'now'})`);
      });
    }

    // 5. Status summary
    console.log(`\n${"=".repeat(60)}`);
    const isInsightsComplete = createdInsights.count === parseInt(totalGen.count);
    const areTranslationsComplete = translations.length === 4 && 
      translations.every(t => t.count === parseInt(createdInsights.count));

    if (isInsightsComplete && areTranslationsComplete) {
      console.log("🎉 STATUS: 100% COMPLETE! ALL DONE!");
    } else if (isInsightsComplete && !areTranslationsComplete) {
      console.log("⏳ STATUS: Insights complete, translations in progress...");
    } else {
      console.log("⏳ STATUS: Generation in progress...");
    }
    console.log("=".repeat(60) + "\n");

    return {
      total: parseInt(totalGen.count),
      insights: parseInt(createdInsights.count),
      translations: translations.reduce((acc, t) => {
        acc[t.locale] = parseInt(t.count);
        return acc;
      }, {}),
      isComplete: isInsightsComplete && areTranslationsComplete,
      missing: missing.length
    };

  } catch (error) {
    console.error("❌ Error checking progress:", error.message);
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
}

// Run check
checkProgress()
  .then(result => {
    process.exit(result.isComplete ? 0 : 1);
  })
  .catch(() => {
    process.exit(1);
  });

