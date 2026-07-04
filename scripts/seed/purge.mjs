// One-shot purge of ALL LyVoX demo seed data.
// Removes every advert/media/like/business/profile/auth-user tied to the
// @lyvox-seed.be accounts, plus the uploaded images under ad-media/seed/.
//
//   node scripts/seed/purge.mjs

import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

for (const file of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL } = process.env;
const SEED_DOMAIN = 'lyvox-seed.be';
const BUCKET = 'ad-media';

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const pg = new Client({ connectionString: SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  await pg.connect();
  const { rows: users } = await pg.query(
    `select id from auth.users where email like '%@' || $1`, [SEED_DOMAIN],
  );
  const ids = users.map((u) => u.id);
  console.log(`Found ${ids.length} seed users.`);
  if (ids.length === 0) { await pg.end(); return; }

  const { rows: adverts } = await pg.query(`select id from public.adverts where user_id = any($1)`, [ids]);
  const advIds = adverts.map((a) => a.id);
  const { rows: convs } = await pg.query(
    `select id from public.conversations where created_by = any($1)
       or ($2::uuid[] is not null and advert_id = any($2))`,
    [ids, advIds.length ? advIds : null],
  );
  const convIds = convs.map((c) => c.id);

  await pg.query(`delete from public.reviews where reviewer_id = any($1) or subject_id = any($1)`, [ids]);
  if (convIds.length) {
    await pg.query(`delete from public.conversation_participants where conversation_id = any($1)`, [convIds]);
    await pg.query(`delete from public.conversations where id = any($1)`, [convIds]);
  }
  await pg.query(`delete from public.conversation_participants where user_id = any($1)`, [ids]);
  if (advIds.length) {
    await pg.query(`delete from public.media where advert_id = any($1)`, [advIds]);
    await pg.query(`delete from public.advert_likes where advert_id = any($1)`, [advIds]);
    await pg.query(`delete from public.adverts where id = any($1)`, [advIds]);
  }
  await pg.query(`delete from public.advert_likes where user_id = any($1)`, [ids]);
  await pg.query(`delete from public.businesses where created_by = any($1)`, [ids]);
  await pg.query(`delete from public.profiles where id = any($1)`, [ids]);
  console.log(`Deleted ${advIds.length} adverts, ${convIds.length} conversations, and related rows.`);

  // storage: remove seed/ images
  const { data: files } = await supa.storage.from(BUCKET).list('seed', { limit: 1000 });
  if (files?.length) {
    await supa.storage.from(BUCKET).remove(files.map((f) => `seed/${f.name}`));
    console.log(`Removed ${files.length} images from ${BUCKET}/seed.`);
  }
  const { data: previewFiles } = await supa.storage.from('ad-media-preview').list('seed', { limit: 1000 });
  if (previewFiles?.length) {
    await supa.storage.from('ad-media-preview').remove(previewFiles.map((f) => `seed/${f.name}`));
    console.log(`Removed ${previewFiles.length} preview images from ad-media-preview/seed.`);
  }

  // auth users
  for (const id of ids) await supa.auth.admin.deleteUser(id);
  console.log(`Deleted ${ids.length} auth users.`);

  await pg.end();
  console.log('✅ purge complete.');
}
main().catch((e) => { console.error('❌', e); process.exit(1); });
