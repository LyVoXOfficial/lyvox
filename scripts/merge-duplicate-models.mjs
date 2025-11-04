#!/usr/bin/env node
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL required');
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

function normalizeName(name = '') {
  return name.replace(/^bmw\s+/i, '')
             .replace(/^audi\s+/i, '')
             .replace(/^mercedes-benz\s+/i, '')
             .replace(/^kia\s+/i, '')
             .replace(/^lada\s+/i, '')
             .replace(/^ford\s+/i, '')
             .replace(/^renault\s+/i, '')
             .replace(/^seat\s+/i, '')
             .trim()
             .toLowerCase();
}

function canonicalScore(row) {
  let score = 0;
  const slug = row.slug;
  const makePrefix = `${row.make_slug}-`;

  if (slug.startsWith(makePrefix)) score += 10;
  if (/-\d/.test(slug)) score += 5;
  if (slug.endsWith('-')) score += 5;
  if (slug.includes('current')) score += 3;
  // Slight penalty for long slugs
  score += slug.length / 100;
  return score;
}

function arrayUnion(a = [], b = []) {
  if (!Array.isArray(a)) a = [];
  if (!Array.isArray(b)) b = [];
  const map = new Map();
  for (const value of [...a, ...b]) {
    if (value === null || value === undefined) continue;
    const key = typeof value === 'string' ? value : JSON.stringify(value);
    if (!map.has(key)) {
      map.set(key, value);
    }
  }
  return Array.from(map.values());
}

function chooseCanonical(rows) {
  return [...rows].sort((a, b) => canonicalScore(a) - canonicalScore(b))[0];
}

async function mergeModel(dup, canonical) {
  console.log(`   → merge ${dup.slug} -> ${canonical.slug}`);

  // Reload full rows
  const [canonicalRow, dupRow] = await Promise.all([
    client.query('select * from vehicle_models where id = $1', [canonical.id]).then(r => r.rows[0]),
    client.query('select * from vehicle_models where id = $1', [dup.id]).then(r => r.rows[0]),
  ]);

  if (!canonicalRow || !dupRow) {
    console.warn('   ⚠️  One of the models is missing, skipping');
    return;
  }

  const updates = [];
  const values = [];
  let idx = 1;

  const pushUpdate = (column, value) => {
    updates.push(`${column} = $${idx++}`);
    values.push(value);
  };

  const pushJSONUpdate = (column, value) => {
    if (value == null) {
      updates.push(`${column} = NULL`);
    } else {
      updates.push(`${column} = $${idx}::jsonb`);
      values.push(JSON.stringify(value));
      idx++;
    }
  };

  const unionYears = arrayUnion(canonicalRow.years_available, dupRow.years_available)
    .map(v => (typeof v === 'string' ? parseInt(v, 10) : v))
    .filter(v => !Number.isNaN(v))
    .sort((a, b) => a - b);
  if (unionYears.length && JSON.stringify(unionYears) !== JSON.stringify(canonicalRow.years_available)) {
    pushUpdate('years_available', unionYears);
  }

  const bodyTypes = arrayUnion(canonicalRow.body_types_available, dupRow.body_types_available);
  if (bodyTypes.length && JSON.stringify(bodyTypes) !== JSON.stringify(canonicalRow.body_types_available)) {
    pushJSONUpdate('body_types_available', bodyTypes);
  }

  const fuelTypes = arrayUnion(canonicalRow.fuel_types_available, dupRow.fuel_types_available);
  if (fuelTypes.length && JSON.stringify(fuelTypes) !== JSON.stringify(canonicalRow.fuel_types_available)) {
    pushJSONUpdate('fuel_types_available', fuelTypes);
  }

  const transmissions = arrayUnion(canonicalRow.transmission_available, dupRow.transmission_available);
  if (transmissions.length && JSON.stringify(transmissions) !== JSON.stringify(canonicalRow.transmission_available)) {
    pushJSONUpdate('transmission_available', transmissions);
  }

  const firstYearCandidates = [canonicalRow.first_model_year, dupRow.first_model_year].filter(Boolean);
  if (firstYearCandidates.length) {
    const minYear = Math.min(...firstYearCandidates);
    if (canonicalRow.first_model_year !== minYear) pushUpdate('first_model_year', minYear);
  }

  const lastYearCandidates = [canonicalRow.last_model_year, dupRow.last_model_year].filter(Boolean);
  if (lastYearCandidates.length) {
    const maxYear = Math.max(...lastYearCandidates);
    if (canonicalRow.last_model_year !== maxYear) pushUpdate('last_model_year', maxYear);
  }

  if ((canonicalRow.reliability_score == null || canonicalRow.reliability_score === 0) && dupRow.reliability_score != null) {
    pushUpdate('reliability_score', dupRow.reliability_score);
  }

  if ((canonicalRow.popularity_score == null || canonicalRow.popularity_score === 0) && dupRow.popularity_score != null) {
    pushUpdate('popularity_score', dupRow.popularity_score);
  }

  if (updates.length) {
    values.push(canonical.id);
    try {
      await client.query(`update vehicle_models set ${updates.join(', ')} where id = $${idx}`, values);
    } catch (err) {
      console.error('   ❌ Ошибка обновления vehicle_models', {
        canonical: canonical.slug,
        updates,
        values
      });
      throw err;
    }
  }

  // Merge insights
  const dupInsightRes = await client.query('select * from vehicle_insights where model_id = $1', [dup.id]);
  if (dupInsightRes.rowCount) {
    const dupInsight = dupInsightRes.rows[0];
    const canonicalInsightRes = await client.query('select * from vehicle_insights where model_id = $1', [canonical.id]);

    if (canonicalInsightRes.rowCount === 0) {
      await client.query('update vehicle_insights set model_id = $1 where model_id = $2', [canonical.id, dup.id]);
    } else {
      const canonicalInsight = canonicalInsightRes.rows[0];
      const fields = ['pros','cons','inspection_tips','notable_features','engine_examples','common_issues_by_engine'];
      const insightUpdates = [];
      const insightValues = [];
      let i = 1;
      for (const field of fields) {
        const cVal = canonicalInsight[field];
        const dVal = dupInsight[field];
        const cLen = Array.isArray(cVal) ? cVal.length : (cVal ? Object.keys(cVal).length : 0);
        const dLen = Array.isArray(dVal) ? dVal.length : (dVal ? Object.keys(dVal).length : 0);
        if ((cLen === 0 || !cVal) && dLen > 0) {
          if (Array.isArray(dVal) || (typeof dVal === 'object' && dVal !== null)) {
            insightUpdates.push(`${field} = $${i}::jsonb`);
            insightValues.push(JSON.stringify(dVal));
          } else {
            insightUpdates.push(`${field} = $${i}`);
            insightValues.push(dVal);
          }
          i++;
        }
      }
      if ((canonicalInsight.reliability_score == null || canonicalInsight.reliability_score === 0) && dupInsight.reliability_score != null) {
        insightUpdates.push(`reliability_score = $${i++}`);
        insightValues.push(dupInsight.reliability_score);
      }
      if ((canonicalInsight.popularity_score == null || canonicalInsight.popularity_score === 0) && dupInsight.popularity_score != null) {
        insightUpdates.push(`popularity_score = $${i++}`);
        insightValues.push(dupInsight.popularity_score);
      }
      if (insightUpdates.length) {
        insightValues.push(canonical.id);
        await client.query(`update vehicle_insights set ${insightUpdates.join(', ')} where model_id = $${i}`, insightValues);
      }
      await client.query('delete from vehicle_insights where model_id = $1', [dup.id]);
    }
  }

  // Merge generations
  const dupGens = await client.query('select id, code from vehicle_generations where model_id = $1', [dup.id]);
  for (const gen of dupGens.rows) {
    const exists = await client.query('select id from vehicle_generations where model_id = $1 and lower(code) = lower($2) limit 1', [canonical.id, gen.code]);
    if (exists.rowCount) {
      await client.query('delete from vehicle_generations where id = $1', [gen.id]);
    } else {
      await client.query('update vehicle_generations set model_id = $1 where id = $2', [canonical.id, gen.id]);
    }
  }

  // Merge i18n
  await client.query(`
    delete from vehicle_model_i18n a
    using vehicle_model_i18n b
    where a.model_id = $1 and b.model_id = $2 and a.locale = b.locale
  `, [dup.id, canonical.id]);
  await client.query('update vehicle_model_i18n set model_id = $1 where model_id = $2', [canonical.id, dup.id]);

  // Delete duplicate model
  await client.query('delete from vehicle_models where id = $1', [dup.id]);
}

(async () => {
  await client.connect();
  await client.query('begin');

  try {
    const res = await client.query(`
      select mk.slug as make_slug, m.id, m.slug, m.name_en
      from vehicle_models m
      join vehicle_makes mk on mk.id = m.make_id
    `);

    const groups = new Map();

    for (const row of res.rows) {
      const key = `${row.make_slug}::${normalizeName(row.name_en)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }

    let processedGroups = 0;
    for (const [key, rows] of groups.entries()) {
      if (rows.length <= 1) continue;
      processedGroups++;
      const canonical = chooseCanonical(rows);
      console.log(`\n=== Merge group ${key} | canonical: ${canonical.slug}`);

      for (const row of rows) {
        if (row.id === canonical.id) continue;
        await mergeModel(row, canonical);
      }
    }

    await client.query('commit');
    console.log(`\n✅ Completed. Processed groups: ${processedGroups}`);
  } catch (err) {
    await client.query('rollback');
    console.error('❌ Ошибка:', err.message);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
})();


