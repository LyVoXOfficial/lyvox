import { readFile } from 'node:fs/promises';
import { Client } from 'pg';

async function main() {
  const {
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_DB_HOST,
    SUPABASE_DB_PORT,
    SUPABASE_DB_NAME,
    SUPABASE_DB_USER,
  } = process.env;

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY env variable is required');
  }

  const host = SUPABASE_DB_HOST ?? 'db.kjzqowcxojspjtoadzee.supabase.co';
  const port = Number(SUPABASE_DB_PORT ?? 5432);
  const database = SUPABASE_DB_NAME ?? 'postgres';
  const user = SUPABASE_DB_USER ?? 'postgres';
  const sqlPath = process.argv[2] ?? 'supabase/seed.sql';

  const sql = await readFile(sqlPath, 'utf8');

  const client = new Client({
    host,
    port,
    database,
    user,
    password: SUPABASE_SERVICE_ROLE_KEY,
    ssl: { rejectUnauthorized: false },
  });

  console.log(`Connecting to ${user}@${host}:${port}/${database}`);
  await client.connect();

  try {
    console.log(`Executing SQL from ${sqlPath} (${sql.length} bytes)`);
    await client.query(sql);
    console.log('✅ Seed applied successfully');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ Failed to apply seed');
  console.error(err);
  process.exit(1);
});
