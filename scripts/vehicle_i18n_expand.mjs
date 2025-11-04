#!/usr/bin/env node
// Expand deep content localization for vehicle generations: pros, cons, inspection_tips, common_issues, summary
// Env: DATABASE_URL, OPENAI_API_KEY, OPENAI_MODEL (optional), GOOGLE_API_KEY/GOOGLE_MODEL/GOOGLE_API_VERSION (optional),
//       DRY_RUN=true, PGSSL_REJECT_UNAUTHORIZED, PGSSLROOTCERT, PG_KEEPALIVE, PG_KEEPALIVE_DELAY_MS,
//       ONLY_MAKES=make1,make2, LIMIT_ROWS=100

import { Client } from 'pg';
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';

const DB_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!DB_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
const GOOGLE_MODEL = process.env.GOOGLE_MODEL || 'gemini-1.5-flash-latest';
const GOOGLE_API_VERSION = process.env.GOOGLE_API_VERSION || 'v1';
const DRY_RUN = /^true$/i.test(process.env.DRY_RUN || '');
const TARGET_LOCALES = ['en','ru','nl','fr','de'];
const ONLY_MAKES = (process.env.ONLY_MAKES || '').split(',').map((v) => v.trim()).filter(Boolean);
const LIMIT_ROWS = parseInt(process.env.LIMIT_ROWS || '0', 10);

const clientConfig = { connectionString: DB_URL };
if (process.env.PGSSL_REJECT_UNAUTHORIZED === 'false') {
  clientConfig.ssl = { rejectUnauthorized: false };
} else if (process.env.PGSSL_REJECT_UNAUTHORIZED === 'true') {
  clientConfig.ssl = { rejectUnauthorized: true };
}
if (process.env.PGSSLROOTCERT) {
  clientConfig.ssl = clientConfig.ssl || {};
  clientConfig.ssl.ca = process.env.PGSSLROOTCERT;
}
if (process.env.PG_KEEPALIVE === 'true') {
  clientConfig.keepAlive = true;
  const delay = parseInt(process.env.PG_KEEPALIVE_DELAY_MS || '10000', 10);
  if (!Number.isNaN(delay)) clientConfig.keepAliveInitialDelayMillis = delay;
}
const client = new Client(clientConfig);

const BOILERPLATE_HEADERS = [
  'here is the translation',
  "here's the translation",
  'here are the translations',
  'this is the translation',
  'translation',
  'translation output',
  'voici la traduction',
  'hier is de vertaling',
  'hier ist die übersetzung',
  'hier ist die ubersetzung',
  'übersetzung',
  'ubersetzung',
  'vertaling',
  'перевод',
  'перевод текста',
  'traduzione',
  'traduction'
];

function stripBoilerplate(input) {
  let text = (input ?? '').toString();
  if (!text) return '';
  text = text.replace(/```[\s\S]*?```/g, '').replace(/```/g, '');
  text = text.replace(/^\s*[*_`]+/, '').replace(/[*_`]+\s*$/g, '');
  text = text.replace(/^\s*['"“”`]+/, '').replace(/['"“”`]+\s*$/g, '');
  for (const header of BOILERPLATE_HEADERS) {
    const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp('^\\s*' + escaped + '[:\\-]?\\s*', 'i');
    if (pattern.test(text)) {
      text = text.replace(pattern, '');
      break;
    }
  }
  text = text.replace(/(?:^|\n)\s*(?:here|hier|voici|translation|traduction|übersetzung|ubersetzung|vertaling|перевод)[^:\n]*:\s*/gi, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

function hasCyrillic(value) { return /[\u0400-\u04FF]/.test(value || ''); }
function detectLang(value) { return hasCyrillic(value) ? 'ru' : 'en'; }


function ensureLogHeaderSync() {
  if (!existsSync('logs')) mkdirSync('logs', { recursive: true });
  const f = 'logs/vehicle_i18n_expand.csv';
  if (!existsSync(f)) writeFileSync(f, 'generation_id,field_name,locale_written,original_snippet,translated_snippet,timestamp\n');
}

function csv(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

function logWrite(genId, field, locale, original, translated) {
  const f = 'logs/vehicle_i18n_expand.csv';
  const line = [genId, field, locale, csv((original || '').slice(0, 200)), csv((translated || '').slice(0, 200)), new Date().toISOString()].join(',') + '\n';
  appendFileSync(f, line);
}

async function translateWithOpenAI(messages) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OPENAI_MODEL, messages })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI error ${res.status}: ${body}`);
  }
  const data = await res.json();
  return stripBoilerplate(data.choices?.[0]?.message?.content || '');
}

async function translateWithGoogle(system, user) {
  if (!GOOGLE_API_KEY) return '';
  const modelCandidates = [
    GOOGLE_MODEL,
    'gemini-2.0-flash-lite-001',
    'gemini-2.0-flash-001',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro-latest',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro'
  ];
  const versions = [GOOGLE_API_VERSION, GOOGLE_API_VERSION === 'v1' ? 'v1beta' : 'v1'];
  const merged = `${system}\n\n${user}`;
  let lastErr = null;
  for (const modelName of modelCandidates) {
    for (const ver of versions) {
      const url = `https://generativelanguage.googleapis.com/${ver}/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(GOOGLE_API_KEY)}`;
      const body = {
        contents: [{ role: 'user', parts: [{ text: merged }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048, responseMimeType: 'text/plain' }
      };
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        lastErr = await res.text().catch(() => '');
        continue;
      }
      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const raw = parts.map((p) => p?.text || '').join('\n');
      const cleaned = stripBoilerplate(raw);
      if (cleaned) return cleaned;
    }
  }
  throw new Error(`Google error: no candidate model accepted request. Last response: ${lastErr}`);
}

async function translateItem(value, targetLocale, context, sourceLang) {
  const segments = Array.isArray(value) ? value.map((v) => String(v || '').trim()).filter(Boolean) : [String(value || '').trim()];
  if (!segments.length) return Array.isArray(value) ? [] : '';
  if ((sourceLang === 'en' && targetLocale === 'en') || (sourceLang === 'ru' && targetLocale === 'ru')) {
    return Array.isArray(value) ? segments : segments[0];
  }
  const system = 'You are a technical automotive translator. Keep brand/model/engine codes exactly as written (BMW, TDI, DSG, DPF, E46). Do not transliterate or add commentary.';
  const out = [];
  for (const segment of segments) {
    let translated = '';
    const user = `Target locale: ${targetLocale}\nContext: ${context}\nText: ${segment}`;
    try {
      if (GOOGLE_API_KEY) {
        translated = await translateWithGoogle(system, user);
      } else if (OPENAI_API_KEY) {
        translated = await translateWithOpenAI([
          { role: 'system', content: system + ' Respond with the translation only, without preface, quotes, or markdown.' },
          { role: 'user', content: user }
        ]);
      }
    } catch (err) {
      console.error(`Translation error for ${targetLocale}`, err?.message || err);
    }
    let cleaned = stripBoilerplate(translated || segment);
    if (!cleaned && translated) cleaned = stripBoilerplate(translated);
    if (!cleaned) cleaned = segment;
    if (sourceLang !== targetLocale && cleaned.trim() === segment.trim()) {
      cleaned = '';
    }
    if (!cleaned && sourceLang === targetLocale) cleaned = segment;
    out.push(cleaned);
  }
  if (Array.isArray(value)) return out.filter((entry) => entry && entry.trim().length);
  return out.find((entry) => entry && entry.trim().length) || '';
}

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string') return [value];
  return [];
}

async function fetchExisting(genId, locale) {
  const { rows } = await client.query('select summary, pros, cons, inspection_tips, common_issues from public.vehicle_generation_i18n where generation_id = $1 and locale = $2', [genId, locale]);
  return rows[0] || null;
}

async function upsertMerge(genId, locale, patch) {
  const cols = ['summary','pros','cons','inspection_tips','common_issues'];
  const payload = cols.map((col) => patch[col] ?? null);
  const sql = `insert into public.vehicle_generation_i18n (generation_id, locale, summary, pros, cons, inspection_tips, common_issues) values ($1,$2,$3,$4,$5,$6,$7)
    on conflict (generation_id, locale) do update set
      summary = coalesce(EXCLUDED.summary, public.vehicle_generation_i18n.summary),
      pros = coalesce(EXCLUDED.pros, public.vehicle_generation_i18n.pros),
      cons = coalesce(EXCLUDED.cons, public.vehicle_generation_i18n.cons),
      inspection_tips = coalesce(EXCLUDED.inspection_tips, public.vehicle_generation_i18n.inspection_tips),
      common_issues = coalesce(EXCLUDED.common_issues, public.vehicle_generation_i18n.common_issues)`;
  await client.query(sql, [genId, locale, ...payload]);
}

async function main() {
  ensureLogHeaderSync();
  await client.connect();

  let sql = `
    select g.id as generation_id, g.model_id, g.summary as gen_summary,
           md.slug as model_slug, mk.slug as make_slug,
           ins.pros as ins_pros, ins.cons as ins_cons, ins.inspection_tips as ins_tips,
           ins.common_issues_by_engine as ins_issues_by_engine
    from public.vehicle_generations g
    join public.vehicle_models md on md.id = g.model_id
    join public.vehicle_makes mk on mk.id = md.make_id
    left join public.vehicle_insights ins on ins.model_id = md.id`;
  const params = [];
  if (ONLY_MAKES.length) {
    params.push(ONLY_MAKES);
    sql += ` where mk.slug = any($${params.length})`;
  }
  sql += ' order by mk.slug, md.slug';
  if (LIMIT_ROWS > 0) {
    params.push(LIMIT_ROWS);
    sql += ` limit $${params.length}`;
  }

  const { rows } = await client.query(sql, params);

  for (const row of rows) {
    const genId = row.generation_id;
    const context = `${row.make_slug} ${row.model_slug}`;
    const summary = (row.gen_summary || '').trim();
    const pros = toArray(row.ins_pros);
    const cons = toArray(row.ins_cons);
    const tips = toArray(row.ins_tips);

    const issues = [];
    if (row.ins_issues_by_engine) {
      try {
        const obj = typeof row.ins_issues_by_engine === 'string' ? JSON.parse(row.ins_issues_by_engine) : row.ins_issues_by_engine;
        for (const key of Object.keys(obj || {})) {
          const arr = Array.isArray(obj[key]) ? obj[key] : [];
          for (const issue of arr) issues.push(`${key}: ${issue}`);
        }
      } catch (err) {
        console.warn('Failed to parse common_issues_by_engine for', context, err?.message || err);
      }
    }

    const fieldMap = {
      summary,
      pros,
      cons,
      inspection_tips: tips,
      common_issues: issues,
    };

    for (const [field, value] of Object.entries(fieldMap)) {
      const values = Array.isArray(value) ? value : (value ? [value] : []);
      if (!values.length) continue;
      const sourceLang = detectLang(values.join('\n'));

      for (const locale of TARGET_LOCALES) {
        const existing = await fetchExisting(genId, locale);
        const existingValue = existing?.[field];
        if (existingValue && ((Array.isArray(existingValue) && existingValue.length) || (typeof existingValue === 'string' && existingValue.trim()))) {
          continue;
        }

        const translated = await translateItem(value, locale, context, sourceLang);
        if (!translated || (Array.isArray(translated) && !translated.length)) continue;
        const normalized = Array.isArray(value) ? translated.map(stripBoilerplate).filter(Boolean) : stripBoilerplate(translated);
        if (!normalized || (Array.isArray(normalized) && !normalized.length)) continue;

        if (DRY_RUN) {
          logWrite(genId, field, locale, Array.isArray(value) ? value[0] : value, Array.isArray(normalized) ? normalized[0] : normalized);
          continue;
        }

        await upsertMerge(genId, locale, { [field]: normalized });
        logWrite(genId, field, locale, Array.isArray(value) ? value[0] : value, Array.isArray(normalized) ? normalized[0] : normalized);
      }
    }
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
