import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function checkInsightsLinkage() {
  try {
    await client.connect();
    
    console.log("\n🔍 Проверка привязки insights для BMW 5-series...\n");
    
    // Check how insights are linked
    const schemaCheck = await client.query(`
      SELECT 
        column_name, 
        data_type,
        is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'vehicle_insights'
      AND column_name IN ('model_id', 'generation_id')
      ORDER BY ordinal_position
    `);
    
    console.log("📋 Схема таблицы vehicle_insights:");
    console.table(schemaCheck.rows);
    
    // Get BMW 5-series model info
    const modelInfo = await client.query(`
      SELECT 
        vm.id,
        vm.slug,
        vm.name,
        COUNT(vg.id) as generations_count
      FROM vehicle_models vm
      LEFT JOIN vehicle_generations vg ON vg.model_id = vm.id
      WHERE vm.slug LIKE '%5-series%'
        AND vm.slug LIKE '%bmw%'
      GROUP BY vm.id, vm.slug, vm.name
    `);
    
    console.log("\n📊 BMW 5-series модели:");
    console.table(modelInfo.rows);
    
    if (modelInfo.rows.length === 0) {
      console.log("❌ Модель не найдена");
      return;
    }
    
    const modelId = modelInfo.rows[0].id;
    
    // Get insights for this model
    const insights = await client.query(`
      SELECT 
        model_id,
        pros[1:2] as sample_pros,
        cons[1:2] as sample_cons,
        engine_examples,
        reliability_score,
        popularity_score
      FROM vehicle_insights
      WHERE model_id = $1
    `, [modelId]);
    
    console.log("\n📝 Insights для 5-series (model_id):");
    console.table(insights.rows);
    
    // Get all generations for this model
    const generations = await client.query(`
      SELECT 
        id,
        code,
        years_start,
        years_end,
        body_types,
        fuel_types,
        transmission
      FROM vehicle_generations
      WHERE model_id = $1
      ORDER BY years_start
    `, [modelId]);
    
    console.log("\n🔢 Поколения BMW 5-series:");
    console.table(generations.rows);
    
    // Check if there's a generation_id column or FK
    const fkCheck = await client.query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'vehicle_insights'
        AND tc.constraint_type = 'FOREIGN KEY'
    `);
    
    console.log("\n🔗 Foreign Keys в vehicle_insights:");
    console.table(fkCheck.rows);
    
    console.log("\n❌ ПРОБЛЕМА:");
    console.log("Insights привязаны к model_id (вся модель 5-series)");
    console.log("НЕТ привязки к generation_id (конкретное поколение E34)");
    console.log("\nРезультат: E34 (1988-1996) показывает данные для ВСЕЙ модели,");
    console.log("включая современные поколения F10/G30 с двигателями N55/N63!");
    
  } catch (error) {
    console.error("❌ Ошибка:", error.message);
  } finally {
    await client.end().catch(() => {});
  }
}

checkInsightsLinkage();

