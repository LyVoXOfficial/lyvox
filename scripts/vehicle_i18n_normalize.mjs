#!/usr/bin/env node
// Normalise vehicle make/model/generation EN fields by translating RU→EN and preserving original RU in i18n tables.
// Env: DATABASE_URL, OPENAI_API_KEY, OPENAI_MODEL (optional), GOOGLE_API_KEY/GOOGLE_MODEL/GOOGLE_API_VERSION (optional),
//      DRY_RUN=true, PGSSL_REJECT_UNAUTHORIZED, PGSSLROOTCERT, PG_KEEPALIVE, PG_KEEPALIVE_DELAY_MS

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

const LOG_FILE = 'logs/vehicle_i18n_autotranslate.csv';
const BOILERPLATE_HEADERS = [
  'here is the translation',
  "here's the translation",
  'this is the translation',
  'translation',
  'translation output',
  'voici la traduction',
  'hier ist die übersetzung',
  'hier ist die ubersetzung',
  'hier is de vertaling',
  'übersetzung',
  'ubersetzung',
  'vertaling',
  'перевод',
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

function ensureLogHeaderSync() {
  if (!existsSync('logs')) mkdirSync('logs', { recursive: true });
  if (!existsSync(LOG_FILE)) writeFileSync(LOG_FILE, 'table,id,field,detected_lang,before,after,timestamp\n');
}

function csv(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

function logWrite(table, id, field, lang, before, after) {
  const line = [table, id, field, lang, csv(before ?? ''), csv(after ?? ''), new Date().toISOString()].join(',') + '\n';
  appendFileSync(LOG_FILE, line);
}

async function translateWithOpenAI(text, context) {
  const system = 'You are a technical automotive translator. Translate Russian to English while preserving brand/model tokens (BMW, TDI, DSG, DPF, E46). Respond with the translation only, no preface, quotes, or markdown.';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Context: ${context}\nText: ${text}` }
      ]
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI error ${res.status}: ${body}`);
  }
  const data = await res.json();
  return stripBoilerplate(data.choices?.[0]?.message?.content || '');
}

async function translateWithGoogle(text, context) {
  if (!GOOGLE_API_KEY) return '';
  const system = 'You are a technical automotive translator. Translate Russian to English while preserving brand/model tokens (BMW, TDI, DSG, DPF, E46).';
  const merged = `${system}\n\nContext: ${context}\nText: ${text}`;
  const models = [
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
  let lastErr = null;
  for (const modelName of models) {
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

async function translateToEn(text, context) {
  if (!text) return '';
  if (GOOGLE_API_KEY) {
    try {
      const output = await translateWithGoogle(text, context);
      if (output) return output;
    } catch (err) {
      console.error('Google translation failed, falling back to OpenAI if available', err?.message || err);
    }
  }
  if (OPENAI_API_KEY) {
    try {
      return await translateWithOpenAI(text, context);
    } catch (err) {
      console.error('OpenAI translation failed', err?.message || err);
    }
  }
  return text;
}

function hasCyrillic(value) {
  return /[\u0400-\u04FF]/.test(value || '');
}

async function upsertRuI18n(table, idField, idValue, column, data) {
  const sql = `insert into public.${table} (${idField}, locale, ${column}) values ($1,'ru',$2)
    on conflict (${idField}, locale) do update set ${column} = EXCLUDED.${column}`;
  await client.query(sql, [idValue, data]);
}

async function processMakes() {
  const { rows } = await client.query('select id, slug, name_en from public.vehicle_makes');
  for (const row of rows) {
    if (!row.name_en || !hasCyrillic(row.name_en)) continue;
    const translated = stripBoilerplate(await translateToEn(row.name_en, `make slug: ${row.slug}`));
    if (!translated || translated === row.name_en) continue;
    if (DRY_RUN) {
      logWrite('vehicle_makes', row.id, 'name_en', 'ru', row.name_en, translated);
      continue;
    }
    await client.query('update public.vehicle_makes set name_en = $1 where id = $2', [translated, row.id]);
    await upsertRuI18n('vehicle_make_i18n', 'make_id', row.id, 'name', row.name_en);
    logWrite('vehicle_makes', row.id, 'name_en', 'ru', row.name_en, translated);
  }
}

async function processModels() {
  const { rows } = await client.query(`
    select m.id, m.slug, m.name_en, mk.slug as make_slug
    from public.vehicle_models m
    join public.vehicle_makes mk on mk.id = m.make_id
  `);
  for (const row of rows) {
    if (!row.name_en || !hasCyrillic(row.name_en)) continue;
    const translated = stripBoilerplate(await translateToEn(row.name_en, `model slug: ${row.slug}, make: ${row.make_slug}`));
    if (!translated || translated === row.name_en) continue;
    if (DRY_RUN) {
      logWrite('vehicle_models', row.id, 'name_en', 'ru', row.name_en, translated);
      continue;
    }
    await client.query('update public.vehicle_models set name_en = $1 where id = $2', [translated, row.id]);
    await upsertRuI18n('vehicle_model_i18n', 'model_id', row.id, 'name', row.name_en);
    logWrite('vehicle_models', row.id, 'name_en', 'ru', row.name_en, translated);
  }
}

async function processGenerations() {
  const { rows } = await client.query(`
    select g.id, g.summary, md.slug as model_slug, mk.slug as make_slug
    from public.vehicle_generations g
    join public.vehicle_models md on md.id = g.model_id
    join public.vehicle_makes mk on mk.id = md.make_id
  `);
  for (const row of rows) {
    if (!row.summary || !hasCyrillic(row.summary)) continue;
    const translated = stripBoilerplate(await translateToEn(row.summary, `generation of ${row.make_slug} ${row.model_slug}`));
    if (!translated || translated === row.summary) continue;
    if (DRY_RUN) {
      logWrite('vehicle_generations', row.id, 'summary', 'ru', row.summary, translated);
      continue;
    }
    await client.query('update public.vehicle_generations set summary = $1 where id = $2', [translated, row.id]);
    await upsertRuI18n('vehicle_generation_i18n', 'generation_id', row.id, 'summary', row.summary);
    logWrite('vehicle_generations', row.id, 'summary', 'ru', row.summary, translated);
  }
}

async function main() {
  ensureLogHeaderSync();
  await client.connect();
  await processMakes();
  await processModels();
  await processGenerations();
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
