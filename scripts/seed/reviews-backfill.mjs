// One-off: clean orphan seed conversations and seed chat-gated reviews for
// existing seed adverts. Safe to re-run (clears prior seed conversations/reviews first).
//   node scripts/seed/reviews-backfill.mjs

import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

for (const f of ['.env.local', '.env']) {
  try { for (const l of readFileSync(f, 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch {}
}
const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const rnd = (n) => Math.floor(Math.random() * n);
const COMMENTS = [
  'Всё прошло отлично, продавец на связи. Рекомендую!',
  'Товар как на фото, быстро договорились. Спасибо!',
  'Приятная сделка, всё честно. Можно брать.',
  'Ответил быстро, помог с осмотром. Доволен.',
  'Хороший продавец, аккуратно упаковал. 5 звёзд.',
  'Немного задержался с ответом, но в итоге всё ок.',
];

async function bulk(table, cols, rows, extra = '') {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const params = [];
    const tuples = chunk.map((r) => `(${r.map((v) => { params.push(v); return `$${params.length}`; }).join(',')})`);
    await pg.query(`insert into ${table} (${cols.join(',')}) values ${tuples.join(',')} ${extra}`, params);
  }
}

async function main() {
  await pg.connect();
  const { rows: users } = await pg.query(`select id from auth.users where email like '%@lyvox-seed.be'`);
  const ids = users.map((u) => u.id);

  // clean prior seed conversations/reviews so this is idempotent
  const { rows: oldConvs } = await pg.query(`select id from public.conversations where created_by = any($1)`, [ids]);
  const oldConvIds = oldConvs.map((c) => c.id);
  await pg.query(`delete from public.reviews where reviewer_id = any($1) or subject_id = any($1)`, [ids]);
  if (oldConvIds.length) {
    await pg.query(`delete from public.conversation_participants where conversation_id = any($1)`, [oldConvIds]);
    await pg.query(`delete from public.conversations where id = any($1)`, [oldConvIds]);
  }
  console.log(`cleaned ${oldConvIds.length} orphan conversations`);

  // pick adverts to review
  const { rows: ads } = await pg.query(
    `select a.id, a.user_id from public.adverts a
       join auth.users u on u.id = a.user_id
      where u.email like '%@lyvox-seed.be' and a.status='active'
      order by random() limit 130`,
  );

  const convRows = [], partRows = [], reviewRows = [];
  const seen = new Set();
  let n = 0;
  for (const ad of ads) {
    if (n >= 120) break;
    const reviewerId = ids[rnd(ids.length)];
    if (reviewerId === ad.user_id) continue;
    const key = `${ad.id}:${reviewerId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const convId = randomUUID();
    convRows.push([convId, reviewerId, ad.id]);
    partRows.push([convId, reviewerId, 'peer'], [convId, ad.user_id, 'owner']);
    reviewRows.push([randomUUID(), ad.id, reviewerId, ad.user_id, 4 + rnd(2), COMMENTS[n % COMMENTS.length]]);
    n++;
  }

  await bulk('public.conversations', ['id', 'created_by', 'advert_id'], convRows);
  await bulk('public.conversation_participants', ['conversation_id', 'user_id', 'role'], partRows, 'on conflict do nothing');
  await bulk('public.reviews', ['id', 'advert_id', 'reviewer_id', 'subject_id', 'rating', 'comment'], reviewRows, 'on conflict do nothing');
  console.log(`✅ ${reviewRows.length} reviews across ${convRows.length} conversations`);

  const { rows: rated } = await pg.query(
    `select count(*) c, round(avg(rating),2) avg from public.reviews where reviewer_id = any($1)`, [ids]);
  console.log('reviews now:', rated[0]);
  await pg.end();
}
main().catch((e) => { console.error('❌', e); process.exit(1); });
