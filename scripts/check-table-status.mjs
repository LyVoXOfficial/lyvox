import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

(async () => {
  try {
    await client.connect();

    // Check if vehicle_insights_i18n table exists
    const { rows } = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'vehicle_insights_i18n'
      ) as exists
    `);

    console.log("✅ vehicle_insights_i18n table exists:", rows[0].exists);

    if (rows[0].exists) {
      const { rows: countRows } = await client.query(
        "SELECT COUNT(*) FROM vehicle_insights_i18n"
      );
      console.log("📊 Records in vehicle_insights_i18n:", countRows[0].count);

      // Check distinct locales
      const { rows: locales } = await client.query(`
        SELECT locale, COUNT(*) as count 
        FROM vehicle_insights_i18n 
        GROUP BY locale 
        ORDER BY locale
      `);

      console.log("\n📋 Records by locale:");
      locales.forEach((row) => {
        console.log(`  ${row.locale}: ${row.count} models`);
      });

      // Check coverage
      const { rows: coverage } = await client.query(`
        SELECT 
          COUNT(DISTINCT model_id) as models_with_translations,
          (SELECT COUNT(*) FROM vehicle_insights) as total_models
        FROM vehicle_insights_i18n
      `);

      const percent =
        (coverage[0].models_with_translations /
          coverage[0].total_models) *
        100;
      console.log(
        `\n🎯 Coverage: ${coverage[0].models_with_translations}/${coverage[0].total_models} models (${percent.toFixed(1)}%)`
      );
    }

    await client.end().catch(() => {});
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();

