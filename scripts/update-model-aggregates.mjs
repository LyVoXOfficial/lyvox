#!/usr/bin/env node
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
const DRY_RUN = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL required');
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

function arrayUnion(list) {
  const map = new Map();
  for (const value of list) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const inner of value) {
        if (inner === null || inner === undefined) continue;
        const key = typeof inner === 'string' ? inner : JSON.stringify(inner);
        if (!map.has(key)) map.set(key, inner);
      }
    } else {
      const key = typeof value === 'string' ? value : JSON.stringify(value);
      if (!map.has(key)) map.set(key, value);
    }
  }
  return Array.from(map.values());
}

function expandYears(start, end) {
  const currentYear = new Date().getFullYear();
  if (!start) return [];
  if (!end || end < start) end = currentYear;
  const years = [];
  for (let y = start; y <= end; y++) {
    years.push(y);
  }
  return years;
}

(async () => {
  await client.connect();
  
  if (DRY_RUN) {
    console.log('🔍 DRY_RUN режим - показываю что будет обновлено (первые 10):');
  }
  
  if (!DRY_RUN) {
    await client.query('begin');
  }

  try {
    const models = await client.query(`
      select m.id, m.slug, mk.slug as make_slug, m.first_model_year, m.last_model_year,
             m.years_available, m.body_types_available, m.fuel_types_available, m.transmission_available
      from vehicle_models m
      join vehicle_makes mk on mk.id = m.make_id
    `);

    let updated = 0;
    let dryRunCount = 0;

    for (const model of models.rows) {
      const generations = await client.query(`
        select start_year, end_year, body_types, fuel_types, transmission_types
        from vehicle_generations
        where model_id = $1
      `, [model.id]);

      if (generations.rowCount === 0) continue;

      let years = [];
      const bodyTypesSource = [];
      const fuelTypesSource = [];
      const transmissionSource = [];

      generations.rows.forEach(gen => {
        years = years.concat(expandYears(gen.start_year, gen.end_year));
        if (gen.body_types) bodyTypesSource.push(gen.body_types);
        if (gen.fuel_types) fuelTypesSource.push(gen.fuel_types);
        if (gen.transmission_types) transmissionSource.push(gen.transmission_types);
      });

      years = Array.from(new Set(years.filter(Boolean))).sort((a, b) => a - b);

      const bodyTypes = arrayUnion(bodyTypesSource);
      const fuelTypes = arrayUnion(fuelTypesSource);
      const transmissions = arrayUnion(transmissionSource);

      const firstYear = years.length ? Math.min(...years) : model.first_model_year;
      const lastYear = years.length ? Math.max(...years) : model.last_model_year;

      const updates = [];
      const values = [];
      let idx = 1;

      const push = (column, value) => {
        updates.push(`${column} = $${idx++}`);
        values.push(value);
      };

      const pushJSON = (column, value) => {
        if (!value || value.length === 0) return;
        updates.push(`${column} = $${idx}::jsonb`);
        values.push(JSON.stringify(value));
        idx++;
      };

      if (years.length && JSON.stringify(model.years_available || []) !== JSON.stringify(years)) {
        push('years_available', years);
      }

      if (firstYear && firstYear !== model.first_model_year) {
        push('first_model_year', firstYear);
      }

      if (lastYear && lastYear !== model.last_model_year) {
        push('last_model_year', lastYear);
      }

      if (bodyTypes.length) pushJSON('body_types_available', bodyTypes);
      if (fuelTypes.length) pushJSON('fuel_types_available', fuelTypes);
      if (transmissions.length) pushJSON('transmission_available', transmissions);

      if (updates.length) {
        if (DRY_RUN) {
          if (dryRunCount < 10) {
            console.log(`  ${model.make_slug} / ${model.slug}: ${updates.join(', ')}`);
          }
          dryRunCount++;
        } else {
          values.push(model.id);
          await client.query(`update vehicle_models set ${updates.join(', ')} where id = $${idx}`, values);
        }
        updated++;
      }
    }

    if (DRY_RUN) {
      console.log(`\n📊 Будет обновлено моделей: ${updated}`);
      if (dryRunCount > 10) {
        console.log(`   (показаны первые 10 из ${dryRunCount})`);
      }
    } else {
      await client.query('commit');
      console.log(`✅ Обновлено моделей: ${updated}`);
    }
  } catch (err) {
    if (!DRY_RUN) {
      await client.query('rollback');
    }
    console.error('❌ Ошибка:', err.message);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
})();


