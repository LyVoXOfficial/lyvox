import { Client } from 'pg';

const DB_URL = process.env.DATABASE_URL;
const client = new Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }
});

await client.connect();

const res = await client.query(`
  SELECT * FROM vehicle_makes 
  WHERE slug IN ('amc', 'daewoo', 'hummer', 'bogdan', 'bristol')
  ORDER BY slug
`);

console.log(`Found: ${res.rows.length} марок`);
res.rows.forEach(row => {
  console.log(`- ${row.slug}: ${row.name_en}`);
});

// Также проверим общее количество
const total = await client.query(`SELECT COUNT(*) as count FROM vehicle_makes`);
console.log(`\nВсего марок в БД: ${total.rows[0].count}`);

await client.end();

