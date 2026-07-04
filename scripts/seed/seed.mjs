// LyVoX demo-data seeder.
// Creates seed users (individual + business), realistic adverts per category,
// uploads real images into the `ad-media` storage bucket, and adds likes.
//
// Auth users are created via the Admin API (correct login fields); everything
// else is written over a direct `postgres` connection (bypasses RLS/column-locks).
//
// All seed users use the @lyvox-seed.be email domain so they are purgeable in
// one shot (see purge.mjs). Passwords are random and printed to the console only
// — never committed, never shown on the site.
//
//   node scripts/seed/seed.mjs --slice        # 5 ads in one category, verify pipeline
//   node scripts/seed/seed.mjs --per=N         # N ads in every leaf category
//   node scripts/seed/seed.mjs --top=M --per=N # N ads in M leaves per top-level tree

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

// ---- env ----------------------------------------------------------------
for (const file of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_DB_URL) {
  throw new Error('Need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL');
}

const args = process.argv.slice(2);
const flag = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : def;
};
const SLICE = args.includes('--slice');
const PER = Number(flag('per', SLICE ? 5 : 8));
const TOP_LEAVES = flag('top', null); // leaves per top-level tree, or null = all leaves

const SEED_DOMAIN = 'lyvox-seed.be';
const BUCKET = 'ad-media';
const MANIFEST_DIR =
  'C:/Users/power/AppData/Local/Temp/claude/C--LyvoxMarketPlace/6b79218e-04d7-4f34-b0ef-aa12f9227fc0/scratchpad';

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const pg = new Client({ connectionString: SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

// ---- personas -----------------------------------------------------------
// 9 individuals (mix of verification) + 1 business seller.
const LOCATIONS = [
  ['Brussel', '1000'], ['Gent', '9000'], ['Antwerpen', '2000'], ['Charleroi', '6000'],
  ['Liège', '4000'], ['Brugge', '8000'], ['Leuven', '3000'], ['Namur', '5000'],
];
const PERSONAS = [
  { key: 'anna', name: 'Anna Verstraeten', type: 'individual', vEmail: true, vPhone: true, phone: '+32487100001' },
  { key: 'mark', name: 'Mark De Smet', type: 'individual', vEmail: true, vPhone: true, phone: '+32487100002' },
  { key: 'lisa', name: 'Lisa Janssens', type: 'individual', vEmail: true, vPhone: false, phone: '+32487100003' },
  { key: 'youssef', name: 'Youssef El Amrani', type: 'individual', vEmail: true, vPhone: true, phone: '+32487100004' },
  { key: 'emma', name: 'Emma Peeters', type: 'individual', vEmail: false, vPhone: false, phone: '+32487100005' },
  { key: 'thomas', name: 'Thomas Maes', type: 'individual', vEmail: true, vPhone: true, phone: '+32487100006' },
  { key: 'sofie', name: 'Sofie Willems', type: 'individual', vEmail: false, vPhone: false, phone: '+32487100007' },
  { key: 'diego', name: 'Diego Fernández', type: 'individual', vEmail: true, vPhone: true, phone: '+32487100008' },
  { key: 'julia', name: 'Julia Claes', type: 'individual', vEmail: true, vPhone: false, phone: '+32487100009' },
  { key: 'techstore', name: 'TechStore BVBA', type: 'business', vEmail: true, vPhone: true, phone: '+32487100010' },
];

const pick = (arr, i) => arr[i % arr.length];
const rnd = (n) => Math.floor(Math.random() * n);
const sample = (arr, k) => [...arr].sort(() => Math.random() - 0.5).slice(0, k);

// Bulk multi-row insert. rows = array of arrays (column values in `columns` order).
async function bulkInsert(table, columns, rows, extra = '') {
  if (!rows.length) return;
  const params = [];
  const tuples = rows.map((row) => {
    const ph = row.map((v) => { params.push(v); return `$${params.length}`; });
    return `(${ph.join(',')})`;
  });
  await pg.query(
    `insert into ${table} (${columns.join(',')}) values ${tuples.join(',')} ${extra}`,
    params,
  );
}

// ---- users --------------------------------------------------------------
async function ensureUsers() {
  const creds = [];
  // Build a lookup of existing seed users (idempotent re-runs).
  const existing = new Map();
  for (let page = 1; page <= 10; page++) {
    const { data } = await supa.auth.admin.listUsers({ page, perPage: 200 });
    if (!data?.users?.length) break;
    for (const u of data.users) if (u.email?.endsWith(`@${SEED_DOMAIN}`)) existing.set(u.email, u);
    if (data.users.length < 200) break;
  }

  for (const p of PERSONAS) {
    p.email = `${p.key}@${SEED_DOMAIN}`;
    const found = existing.get(p.email);
    if (found) {
      p.id = found.id;
      creds.push({ email: p.email, password: '(existing — unchanged)', type: p.type });
      continue;
    }
    const password = randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '') + 'Aa1!';
    const { data, error } = await supa.auth.admin.createUser({
      email: p.email,
      password,
      email_confirm: true,
      user_metadata: { display_name: p.name },
    });
    if (error) throw new Error(`createUser ${p.email}: ${error.message}`);
    p.id = data.user.id;
    creds.push({ email: p.email, password, type: p.type });
  }
  return creds;
}

async function upsertProfiles() {
  for (let i = 0; i < PERSONAS.length; i++) {
    const p = PERSONAS[i];
    const [, postcode] = pick(LOCATIONS, i);
    await pg.query(
      // is_seed=true (T18): mark seeded profiles so the launch-gate switch can
      // exclude them from aggregates. Direct pg connection bypasses column-locks.
      `insert into public.profiles (id, display_name, seller_type, verified_email, verified_phone, phone, rating, is_seed, created_at)
       values ($1,$2,$3,$4,$5,$6,$7, true, now() - interval '40 days')
       on conflict (id) do update set
         display_name=excluded.display_name, seller_type=excluded.seller_type,
         verified_email=excluded.verified_email, verified_phone=excluded.verified_phone, phone=excluded.phone,
         is_seed=true`,
      [p.id, p.name, p.type, p.vEmail, p.vPhone, p.phone, (4 + Math.random()).toFixed(2)],
    );
  }
}

async function ensureBusiness() {
  const owner = PERSONAS.find((p) => p.type === 'business');
  const { rows } = await pg.query(`select id from public.businesses where created_by=$1 limit 1`, [owner.id]);
  if (rows.length) return rows[0].id;
  const id = randomUUID();
  await pg.query(
    `insert into public.businesses
       (id, legal_name, trade_name, legal_form, kbo_number, vat_liable, email, phone_e164,
        address_line, postcode, city, country, status, entity_verified, created_by, created_at, updated_at)
     values ($1,$2,$3,'BVBA','0123456789', true, $4, $5,
        'Nieuwstraat 12', '2000', 'Antwerpen', 'BE', 'active', true, $6, now(), now())`,
    [id, 'TechStore BVBA', 'TechStore', owner.email, owner.phone, owner.id],
  );
  return id;
}

// ---- images: download real photos, upload to ad-media bucket -------------
// Returns relative bucket paths (matching how real listings store media.url).
async function buildImagePool(n) {
  const paths = [];
  for (let i = 0; i < n; i++) {
    const seed = `lyvox-${Date.now()}-${i}-${rnd(100000)}`;
    const res = await fetch(`https://picsum.photos/seed/${seed}/800/600`);
    if (!res.ok) throw new Error(`picsum ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const path = `seed/${seed}.jpg`;
    const { error } = await supa.storage.from(BUCKET).upload(path, buf, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (error) throw new Error(`upload ${path}: ${error.message}`);
    paths.push(path);
    process.stdout.write(`  📸 uploaded ${i + 1}/${n}\r`);
  }
  console.log(`\n  ✓ image pool: ${n} photos in ${BUCKET}`);
  return paths;
}

// ---- adverts ------------------------------------------------------------
const COND = ['used', 'used', 'used', 'new'];
const DESC = (name, city) =>
  `${name}.\n\nВ хорошем состоянии, проверено и готово к использованию. ` +
  `Возможен осмотр и небольшой торг. Самовывоз — ${city}, либо отправка по Бельгии.\n\n` +
  `Пишите в чат LyVoX — отвечаю быстро.`;

const QUALIFIERS = ['отличное состояние', 'почти новое', 'срочно', 'недорого', 'торг уместен', 'как новый', 'в подарок чехол', 'без дефектов'];

// Pure row builder — accumulates into shared arrays; main() bulk-inserts in chunks.
function buildCategoryRows(catId, catName, count, imagePool, businessId, startIdx, acc) {
  for (let i = 0; i < count; i++) {
    const seller = pick(PERSONAS, startIdx + i + rnd(PERSONAS.length));
    const [city, postcode] = pick(LOCATIONS, startIdx + i);
    const title = `${catName} — ${pick(QUALIFIERS, startIdx + i)}`;
    const price = 15 + rnd(40) * 5 + rnd(4) * 100;
    const advId = randomUUID();
    const createdAt = new Date(Date.now() - ((startIdx + i) * 3 + rnd(24)) * 3600 * 1000);
    acc.ads.push([advId, seller.id, catId, title, DESC(catName, city), price, 'EUR',
      pick(COND, i), 'active', 'approved', `${city}, ${postcode}`,
      seller.type === 'business' ? businessId : null, createdAt]);
    sample(imagePool, 2 + rnd(2)).forEach((url, s) => acc.media.push([randomUUID(), advId, url, s]));
    for (const u of sample(PERSONAS.filter((p) => p.id !== seller.id), 1 + rnd(6))) {
      acc.likes.push([u.id, advId]);
    }
  }
}

// Insert big row sets in chunks small enough to stay under pg's param limit.
async function insertChunked(table, columns, rows, perChunk, extra = '') {
  for (let i = 0; i < rows.length; i += perChunk) {
    await bulkInsert(table, columns, rows.slice(i, i + perChunk), extra);
  }
}

// ---- main ---------------------------------------------------------------
async function main() {
  await pg.connect();
  console.log('👥 ensuring seed users…');
  const creds = await ensureUsers();
  await upsertProfiles();
  const businessId = await ensureBusiness();
  console.log(`  ✓ ${PERSONAS.length} users (1 business)`);

  console.log('🖼️  building image pool…');
  const imagePool = await buildImagePool(SLICE ? 6 : 24);

  // choose categories
  let categories;
  if (SLICE) {
    const { rows } = await pg.query(
      `select id, name_ru from public.categories where level=3 and name_ru='Видеокамеры' limit 1`,
    );
    categories = rows;
  } else if (TOP_LEAVES) {
    const { rows } = await pg.query(
      `select id, name_ru from (
         select id, name_ru, split_part(path,'/',1) top,
                row_number() over (partition by split_part(path,'/',1) order by name_ru) rn
         from public.categories where level=3 and is_active
       ) t where rn <= $1`, [Number(TOP_LEAVES)],
    );
    categories = rows;
  } else {
    const { rows } = await pg.query(
      `select id, name_ru from public.categories where level=3 and is_active order by name_ru`,
    );
    categories = rows;
  }

  console.log(`📢 building ${PER} adverts × ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}…`);
  const acc = { ads: [], media: [], likes: [] };
  categories.forEach((cat, idx) => buildCategoryRows(cat.id, cat.name_ru, PER, imagePool, businessId, idx * PER, acc));

  console.log(`💾 inserting ${acc.ads.length} adverts, ${acc.media.length} media, ${acc.likes.length} likes…`);
  await insertChunked('public.adverts',
    ['id', 'user_id', 'category_id', 'title', 'description', 'price', 'currency',
     'condition', 'status', 'moderation_status', 'location', 'business_id', 'created_at'],
    acc.ads, 400);
  await insertChunked('public.media', ['id', 'advert_id', 'url', 'sort'], acc.media, 1000);
  await insertChunked('public.advert_likes', ['user_id', 'advert_id'], acc.likes, 1000,
    'on conflict do nothing');
  console.log(`  ✓ ${acc.ads.length} adverts created`);

  // ---- reviews (chat-gated in app; we create the conversation + review directly) ----
  const reviewTarget = Math.min(SLICE ? 3 : 120, acc.ads.length);
  console.log(`⭐ seeding ${reviewTarget} reviews (with conversations)…`);
  const COMMENTS = [
    'Всё прошло отлично, продавец на связи. Рекомендую!',
    'Товар как на фото, быстро договорились. Спасибо!',
    'Приятная сделка, всё честно. Можно брать.',
    'Ответил быстро, помог с осмотром. Доволен.',
    'Хороший продавец, аккуратно упаковал. 5 звёзд.',
    'Немного задержался с ответом, но в итоге всё ок.',
  ];
  const convRows = [], partRows = [], reviewRows = [];
  const reviewedPairs = new Set();
  let picked = 0;
  for (const ad of acc.ads) {
    if (picked >= reviewTarget) break;
    const [advId, sellerId] = ad;
    const reviewer = PERSONAS[rnd(PERSONAS.length)];
    if (reviewer.id === sellerId) continue;
    const key = `${advId}:${reviewer.id}`;
    if (reviewedPairs.has(key)) continue;
    reviewedPairs.add(key);
    const convId = randomUUID();
    convRows.push([convId, reviewer.id, advId]);
    partRows.push([convId, reviewer.id, 'peer'], [convId, sellerId, 'owner']);
    const rating = 4 + rnd(2); // 4–5 mostly positive
    reviewRows.push([randomUUID(), advId, reviewer.id, sellerId, rating, pick(COMMENTS, picked)]);
    picked++;
  }
  await insertChunked('public.conversations', ['id', 'created_by', 'advert_id'], convRows, 500);
  await insertChunked('public.conversation_participants', ['conversation_id', 'user_id', 'role'], partRows, 800,
    'on conflict do nothing');
  await insertChunked('public.reviews', ['id', 'advert_id', 'reviewer_id', 'subject_id', 'rating', 'comment'],
    reviewRows, 500, 'on conflict do nothing');
  console.log(`  ✓ ${reviewRows.length} reviews created`);

  console.log('🔄 refreshing category counts…');
  await pg.query(`select public.refresh_category_advert_counts()`).catch((e) => console.log('  (skip:', e.message, ')'));

  // write manifest (scratchpad, never committed)
  try {
    mkdirSync(MANIFEST_DIR, { recursive: true });
    writeFileSync(
      `${MANIFEST_DIR}/seed-credentials.json`,
      JSON.stringify({ created_at: new Date().toISOString(), domain: SEED_DOMAIN, users: creds }, null, 2),
    );
  } catch (e) { console.log('manifest skip:', e.message); }

  await pg.end();

  console.log('\n✅ done. Login credentials (also saved to scratchpad/seed-credentials.json):\n');
  for (const c of creds) console.log(`  ${c.type.padEnd(10)} ${c.email}  ${c.password}`);
  console.log(`\nAll seed accounts use the @${SEED_DOMAIN} domain — purge with: node scripts/seed/purge.mjs`);
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
