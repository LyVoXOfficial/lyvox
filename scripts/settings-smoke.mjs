#!/usr/bin/env node
/**
 * FLAG-01 · Live smoke test for the platform_settings runtime-config layer.
 *
 * Exercises the real prod Postgres + Upstash Redis (same infra the deployed app uses) to
 * prove the resolver contract end-to-end:
 *   1. write a namespaced test setting via service-role, read it back (DB round-trip);
 *   2. read again → served from the Upstash cache (fast, no DB);
 *   3. CROSS-INSTANCE staleness: mutate the row DIRECTLY in the DB (no cache invalidation,
 *      simulating another Fluid Compute instance's write) → the cached read is still STALE
 *      until the TTL expires, then goes FRESH. This is the actual FLAG-01 acceptance
 *      criterion ("flip visible within TTL on all instances").
 *   4. explicit invalidation (setSetting) makes the change immediate;
 *   5. cleanup — the test key is deleted from both the DB and the cache.
 *
 * Reads creds from the environment (SUPABASE_*, UPSTASH_*). Run: `pnpm settings:smoke`.
 * Uses a short override TTL so the wait is a few seconds, not 30.
 */

import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

// @upstash/redis lives only under apps/web/node_modules (pnpm monorepo), so resolve both
// deps from the web workspace rather than this script's location under scripts/.
const requireWeb = createRequire(pathToFileURL(path.resolve("apps/web/package.json")));
const importWeb = async (spec) => import(pathToFileURL(requireWeb.resolve(spec)).href);
const { createClient } = await importWeb("@supabase/supabase-js");
const { Redis } = await importWeb("@upstash/redis");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!redisUrl || !redisToken) {
  console.error("Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const redis = new Redis({ url: redisUrl, token: redisToken });

const TEST_KEY = "capability:__smoke_test__";
const CACHE_KEY = `settings:v1:${TEST_KEY}`;
const TTL = 3; // seconds — short so the smoke is quick

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failed = true;
};

// Mirror of the resolver's read path (DB behind Upstash, positive-only cache, TTL).
async function getSettingCached(key) {
  const cached = await redis.get(CACHE_KEY);
  if (cached !== null && cached !== undefined) return cached;
  const { data, error } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const value = data?.value ?? null;
  if (value !== null) await redis.set(CACHE_KEY, value, { ex: TTL });
  return value;
}

async function setSetting(key, value) {
  const { error } = await supabase
    .from("platform_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  await redis.del(CACHE_KEY); // explicit invalidation
}

async function main() {
  // clean slate
  await redis.del(CACHE_KEY);
  await supabase.from("platform_settings").delete().eq("key", TEST_KEY);

  // 1. write + read (DB round-trip)
  await setSetting(TEST_KEY, { enabled: true });
  const v1 = await getSettingCached(TEST_KEY);
  check("write→read returns the value", v1?.enabled === true, JSON.stringify(v1));

  // 2. cached read (key should now exist in Redis)
  const cachedRaw = await redis.get(CACHE_KEY);
  check("second read is served from Upstash cache", cachedRaw?.enabled === true);

  // 3. cross-instance staleness: mutate DB directly, DO NOT invalidate
  await supabase
    .from("platform_settings")
    .update({ value: { enabled: false }, updated_at: new Date().toISOString() })
    .eq("key", TEST_KEY);
  const stale = await getSettingCached(TEST_KEY);
  check("cached read is STILL STALE before TTL (no explicit invalidation)", stale?.enabled === true);

  // wait out the TTL → cache expires → fresh DB read
  await sleep((TTL + 1) * 1000);
  const fresh = await getSettingCached(TEST_KEY);
  check("cached read goes FRESH after TTL expiry (cross-instance propagation)", fresh?.enabled === false);

  // 4. explicit invalidation is immediate
  await setSetting(TEST_KEY, { enabled: true });
  const afterInvalidate = await getSettingCached(TEST_KEY);
  check("explicit invalidation reflects immediately", afterInvalidate?.enabled === true);

  // 5. cleanup
  await redis.del(CACHE_KEY);
  await supabase.from("platform_settings").delete().eq("key", TEST_KEY);
  const { data: leftover } = await supabase
    .from("platform_settings")
    .select("key")
    .eq("key", TEST_KEY)
    .maybeSingle();
  check("cleanup removed the test row", leftover === null);

  console.log(failed ? "\nSMOKE FAILED" : "\nSMOKE PASSED");
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("SMOKE ERROR:", err);
  process.exit(1);
});
