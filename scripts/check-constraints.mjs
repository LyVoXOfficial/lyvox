import { Client } from 'pg';

const DB_URL = process.env.DATABASE_URL;
const client = new Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }
});

await client.connect();

// Check models
const res3 = await client.query(`
  SELECT constraint_name, constraint_type 
  FROM information_schema.table_constraints 
  WHERE table_name='vehicle_models' 
  AND constraint_type IN ('UNIQUE', 'PRIMARY KEY')
`);

console.log('vehicle_models constraints:', res3.rows);

const res4 = await client.query(`
  SELECT indexname, indexdef 
  FROM pg_indexes 
  WHERE tablename='vehicle_models'
`);

console.log('\nvehicle_models indexes:', res4.rows);

// Check generations
const res5 = await client.query(`
  SELECT constraint_name, constraint_type 
  FROM information_schema.table_constraints 
  WHERE table_name='vehicle_generations' 
  AND constraint_type IN ('UNIQUE', 'PRIMARY KEY')
`);

console.log('\nvehicle_generations constraints:', res5.rows);

const res6 = await client.query(`
  SELECT indexname, indexdef 
  FROM pg_indexes 
  WHERE tablename='vehicle_generations'
`);

console.log('\nvehicle_generations indexes:', res6.rows);

await client.end();

