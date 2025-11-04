#!/usr/bin/env node
import pg from 'pg';

const { DATABASE_URL, SLUGS } = process.env;

if (!DATABASE_URL || !SLUGS) {
  console.error('Usage: SLUGS="a4,a4-b9" DATABASE_URL=... node scripts/dump-model-fields.mjs');
  process.exit(1);
}

const slugs = SLUGS.split(',').map(s => s.trim()).filter(Boolean);

const client = new pg.Client({ connectionString: DATABASE_URL });

(async () => {
  await client.connect();
  const res = await client.query('select slug, body_types_available, fuel_types_available, transmission_available, years_available from vehicle_models where slug = any($1::text[])', [slugs]);
  console.log(res.rows);
  await client.end();
})();


