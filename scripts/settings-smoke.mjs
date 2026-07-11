#!/usr/bin/env node
/**
 * FLAG-01 · Live smoke test for the platform_settings runtime-config layer.
 *
 * Exercises the real prod Postgres + Upstash Redis (same infra the deployed app uses) to
 * prove the resolver contract end-to-end:
 *   1. write a namespaced test setting through the AAL2 admin RPC, read it back;
 *   2. read again → served from the Upstash cache (fast, no DB);
 *   3. CROSS-INSTANCE staleness: call the RPC without app-side cache invalidation
 *      (simulating a direct admin API client) → the cached read is still STALE
 *      until the TTL expires, then goes FRESH. This is the actual FLAG-01 acceptance
 *      criterion ("flip visible within TTL on all instances").
 *   4. explicit invalidation (setSetting) makes the change immediate;
 *   5. audit — revision increments and immutable audit rows are present. The
 *      namespaced disabled test row remains intentionally; audit is never deleted.
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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adminAccessToken = process.env.SETTINGS_SMOKE_ADMIN_ACCESS_TOKEN;
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !anonKey || !adminAccessToken) {
  console.error("Missing SUPABASE URL / anon key / SETTINGS_SMOKE_ADMIN_ACCESS_TOKEN (AAL2)");
  process.exit(1);
}
if (!redisUrl || !redisToken) {
  console.error("Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN");
  process.exit(1);
}

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${adminAccessToken}` } },
});
const redis = new Redis({ url: redisUrl, token: redisToken });

const TEST_KEY = "capability:__smoke_test__";
const CACHE_KEY = `settings:v2:${TEST_KEY}`;
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
    .select("key,value,revision,updated_at,updated_by")
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const record = data
    ? {
        key: data.key,
        value: data.value,
        revision: data.revision,
        updatedAt: data.updated_at,
        updatedBy: data.updated_by,
      }
    : null;
  if (record !== null) await redis.set(CACHE_KEY, record, { ex: TTL });
  return record;
}

async function setSetting(key, value, expectedRevision, invalidate = true) {
  const { data, error } = await supabase.rpc("set_platform_setting", {
    p_key: key,
    p_value: value,
    p_reason: "Automated production settings smoke",
    p_expected_revision: expectedRevision,
    p_request_id: `settings-smoke-${Date.now()}`,
  });
  if (error) throw new Error(error.message);
  if (invalidate) await redis.del(CACHE_KEY);
  return Number(data);
}

async function main() {
  await redis.del(CACHE_KEY);
  const { data: initial, error: initialError } = await supabase
    .from("platform_settings")
    .select("key,value,revision")
    .eq("key", TEST_KEY)
    .maybeSingle();
  if (initialError) throw new Error(initialError.message);
  let revision = initial?.revision ?? -1;

  // 1. write + read (DB round-trip)
  revision = await setSetting(TEST_KEY, { enabled: true, smoke: true }, revision);
  const v1 = await getSettingCached(TEST_KEY);
  check("write→read returns the value", v1?.value?.enabled === true, JSON.stringify(v1));
  check("revision incremented", v1?.revision === revision, `revision=${revision}`);

  // 2. cached read (key should now exist in Redis)
  const cachedRaw = await redis.get(CACHE_KEY);
  check("second read is served from Upstash cache", cachedRaw?.value?.enabled === true);

  // 3. direct RPC client cannot invalidate the app cache; TTL remains the bound.
  revision = await setSetting(TEST_KEY, { enabled: false, smoke: true }, revision, false);
  const stale = await getSettingCached(TEST_KEY);
  check("cached read is STILL STALE before TTL (no explicit invalidation)", stale?.value?.enabled === true);

  // wait out the TTL → cache expires → fresh DB read
  await sleep((TTL + 1) * 1000);
  const fresh = await getSettingCached(TEST_KEY);
  check("cached read goes FRESH after TTL expiry (cross-instance propagation)", fresh?.value?.enabled === false);
  check("fresh record has the new revision", fresh?.revision === revision);

  // 4. explicit invalidation is immediate
  revision = await setSetting(TEST_KEY, { enabled: true, smoke: true }, revision);
  const afterInvalidate = await getSettingCached(TEST_KEY);
  check("explicit invalidation reflects immediately", afterInvalidate?.value?.enabled === true);

  // 5. leave a safe disabled row and verify immutable audit evidence.
  revision = await setSetting(TEST_KEY, { enabled: false, emergencyDisabled: true, smoke: true }, revision);
  await redis.del(CACHE_KEY);
  const { data: auditRows, error: auditError } = await supabase
    .from("settings_audit")
    .select("revision,reason,request_id")
    .eq("setting_key", TEST_KEY)
    .order("revision", { ascending: false })
    .limit(4);
  if (auditError) throw new Error(auditError.message);
  check("audit contains the final revision", auditRows?.[0]?.revision === revision);
  check("each smoke mutation has an audit row", (auditRows?.length ?? 0) >= 4);

  console.log(failed ? "\nSMOKE FAILED" : "\nSMOKE PASSED");
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("SMOKE ERROR:", err);
  process.exit(1);
});
