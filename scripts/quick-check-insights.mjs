import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    await client.connect();
    
    // Get columns of vehicle_models
    const columns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'vehicle_models'
      ORDER BY ordinal_position
    `);
    console.log("vehicle_models columns:", columns.rows.map(r => r.column_name).join(", "));
    
    // Get BMW 5-series
    const model = await client.query(`
      SELECT id, slug
      FROM vehicle_models
      WHERE slug LIKE '%5-series%'
      LIMIT 1
    `);
    
    if (model.rows.length === 0) {
      console.log("Model not found");
      return;
    }
    
    console.log("\n5-series model:", model.rows[0]);
    
    // Get insights
    const insights = await client.query(`
      SELECT engine_examples, pros[1], cons[1]
      FROM vehicle_insights
      WHERE model_id = $1
    `, [model.rows[0].id]);
    
    console.log("\nInsights:", insights.rows[0]);
    
    // Get generations
    const gens = await client.query(`
      SELECT code, start_year, end_year, body_types, fuel_types, transmission_types
      FROM vehicle_generations
      WHERE model_id = $1
      ORDER BY start_year
    `, [model.rows[0].id]);
    
    console.log("\nGenerations:");
    console.table(gens.rows);
    
    console.log("\n❌ ПРОБЛЕМА: insights привязаны к MODEL_ID, а не к GENERATION_ID");
    console.log("Все поколения (E28, E34, E39, E60, F10, G30) используют одни insights!");
    
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await client.end().catch(() => {});
  }
}

check();

