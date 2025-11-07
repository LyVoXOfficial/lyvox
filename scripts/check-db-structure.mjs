import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    await client.connect();
    
    console.log("\n=== Checking vehicle_makes structure ===\n");
    const { rows } = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'vehicle_makes' 
      ORDER BY ordinal_position
    `);
    
    console.log("Columns:");
    rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));
    
    console.log("\n=== Sample data ===\n");
    const { rows: samples } = await client.query(`
      SELECT * FROM vehicle_makes LIMIT 3
    `);
    
    console.log(JSON.stringify(samples, null, 2));
    
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await client.end();
  }
}

main();





