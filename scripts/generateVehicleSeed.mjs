import fs from "fs";
import crypto from "crypto";

/**
 * Utility to make stable UUIDs (deterministic from slug strings),
 * so that rerunning seed doesn't create duplicate rows.
 */
function uuidFromSlug(...parts) {
  const hash = crypto.createHash("sha256").update(parts.join("::")).digest("hex");
  // take first 32 chars -> 16 bytes -> UUID v4-like formatting
  const hex = hash.slice(0, 32);
  return (
    hex.slice(0,8) + "-" +
    hex.slice(8,12) + "-" +
    hex.slice(12,16) + "-" +
    hex.slice(16,20) + "-" +
    hex.slice(20,32)
  );
}

// load enriched data (moved to /seed/ to avoid tracking large generated files)
const raw = fs.readFileSync("./seed/vehicles_full_enriched2.json", "utf8");
const data = JSON.parse(raw);

// We'll accumulate SQL statements here
let sql = [];
sql.push("-- AUTO-GENERATED SEED FOR vehicle_* TABLES");
sql.push("begin;");

for (const make of data.makes) {
  // --- vehicle_makes
  const makeSlug = make.slug || make.name_en.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const makeId = uuidFromSlug("make", makeSlug);

  sql.push(`
insert into public.vehicle_makes (id, slug, name_en, country, segment_class, is_active, category_path)
values (
  '${makeId}',
  ${escapeTxt(makeSlug)},
  ${escapeTxt(make.name_en || "")},
  ${escapeTxt(make.country || null)},
  ${escapeTxt(make.segment_class || null)},
  ${make.is_active === false ? "false" : "true"},
  ${escapeTxt(make.category_path || "transport/legkovye-avtomobili")}
)
on conflict do nothing;
  `.trim());

  // for each model
  if (!Array.isArray(make.models)) continue;

  for (const model of make.models) {
    const modelSlug = model.slug || (model.name_en || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const modelId = uuidFromSlug("model", makeSlug, modelSlug);

    // normalize scores (0-100 -> 0-10)
    const reliability = normalizeScore(model.reliability_score);
    const popularity  = normalizeScore(model.popularity_score);

    sql.push(`
insert into public.vehicle_models (
  id,
  make_id,
  slug,
  name_en,
  first_model_year,
  last_model_year,
  years_available,
  body_types_available,
  fuel_types_available,
  transmission_available,
  reliability_score,
  popularity_score
)
values (
  '${modelId}',
  '${makeId}',
  ${escapeTxt(modelSlug)},
  ${escapeTxt(model.name_en || "")},
  ${toIntOrNull(model.first_model_year)},
  ${toIntOrNull(model.last_model_year)},
  ${toPgIntArray(model.years_available)},
  ${toPgJson(model.body_types_available)},
  ${toPgJson(model.fuel_types_available)},
  ${toPgJson(model.transmission_available)},
  ${toNumOrNull(reliability)},
  ${toNumOrNull(popularity)}
)
on conflict (make_id, slug) do nothing;
    `.trim());

    // --- insert generations
    if (Array.isArray(model.generations)) {
      for (const gen of model.generations) {
        const genCode = gen.code || "";
        const genId = uuidFromSlug("gen", makeSlug, modelSlug, genCode);

        sql.push(`
insert into public.vehicle_generations (
  id,
  model_id,
  code,
  start_year,
  end_year,
  facelift,
  production_countries,
  body_types,
  fuel_types,
  transmission_types,
  summary
)
values (
  '${genId}',
  '${modelId}',
  ${escapeTxt(gen.code || "")},
  ${toIntOrNull(gen.start_year)},
  ${toIntOrNull(gen.end_year)},
  ${gen.facelift === true ? "true" : (gen.facelift === false ? "false" : "null")},
  ${toPgTextArray(gen.production_countries)},
  ${toPgJson(gen.body_types)},
  ${toPgJson(gen.fuel_types)},
  ${toPgJson(gen.transmission_types)},
  ${escapeTxt(gen.summary || "")}
)
on conflict (model_id, code) do nothing;
        `.trim());
      }
    }

    // --- insert insight (per model)
    if (model.insight) {
      sql.push(`
insert into public.vehicle_insights (
  model_id,
  pros,
  cons,
  inspection_tips,
  notable_features,
  engine_examples,
  common_issues_by_engine,
  reliability_score,
  popularity_score
)
values (
  '${modelId}',
  ${toPgJson(model.insight.pros)},
  ${toPgJson(model.insight.cons)},
  ${toPgJson(model.insight.inspection_tips)},
  ${toPgJson(model.insight.notable_features)},
  ${toPgJson(model.insight.engine_examples)},
  ${toPgJson(model.insight.common_issues_by_engine)},
  ${toNumOrNull(normalizeScore(model.insight.reliability_score))},
  ${toNumOrNull(normalizeScore(model.insight.popularity_score))}
)
on conflict (model_id) do nothing;
      `.trim());
    }
  }
}

// Ensure every statement ends with a semicolon (helps if someone strips ON CONFLICT clauses)

// Ensure every statement ends with a semicolon and is separated by a blank line
sql = sql.map(s => {
  const t = s.trim();
  if (t === "") return s;
  // Add semicolon if missing
  const withSemicolon = t.endsWith(";") ? t : t + ";";
  // Add extra newline for clarity between statements
  return withSemicolon + "\n";
});

sql.push("commit;");

// write out seed file (root so it can be copied into supabase/seed.sql)
fs.writeFileSync("./vehicles_seed.sql", sql.join("\n\n"), "utf8");
console.log("✅ Generated vehicles_seed.sql");


// ============ helper fns ============

function escapeTxt(strOrNull) {
  if (strOrNull === null || strOrNull === undefined) return "null";
  const s = String(strOrNull).replace(/'/g, "''");
  return `'${s}'`;
}

function toIntOrNull(v) {
  if (v === null || v === undefined) return "null";
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return "null";
  return String(n);
}

function toNumOrNull(v) {
  if (v === null || v === undefined) return "null";
  const n = Number(v);
  if (Number.isNaN(n)) return "null";
  return String(n);
}

// convert [1999,2000,...] -> '{1999,2000,...}' (emit empty array literal for missing/empty)
function toPgIntArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "'{}'::int[]";
  const nums = arr
    .map(y => parseInt(y, 10))
    .filter(y => !Number.isNaN(y));
  if (!nums.length) return "'{}'::int[]";
  // emit standard PostgreSQL int[] literal without extra quotes around numbers
  return `'{${nums.join(',')}}'::int[]`;
}

// convert array or object to jsonb literal
function toPgJson(v) {
  if (v === null || v === undefined) return "'[]'::jsonb";
  const json = JSON.stringify(v).replace(/'/g, "''");
  return `'${json}'::jsonb`;
}

// convert array of strings -> text[] (emit empty array literal for missing/empty)
function toPgTextArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "'{}'::text[]";
  const escaped = arr.map(x => `"${String(x).replace(/"/g, '\\"')}"`);
  return `'{${
    escaped.join(",")
  }}'::text[]`;
}

// Scores may be 0-10 or 0-100. Normalize to 0-10.
function normalizeScore(v) {
  if (v === null || v === undefined) return null;
  const num = Number(v);
  if (Number.isNaN(num)) return null;
  if (num <= 10) return num;
  return (num / 10).toFixed(1); // 85 -> 8.5
}
