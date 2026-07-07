import "server-only";

import { getRedis } from "@/lib/redis";
import { supabaseService } from "@/lib/supabaseService";
import { isCapabilityEnabled, type Capability } from "@/lib/capabilities";
import type { Json } from "@/lib/supabaseTypes";

/**
 * FLAG-01 · Runtime-config resolver.
 *
 * Reads non-secret toggles/config from the `platform_settings` table behind a short-TTL
 * Upstash cache with explicit invalidation on write. Because Upstash is shared across all
 * Fluid Compute instances, a toggle flip propagates to every instance within the TTL — the
 * writer's instance is immediate (explicit del), the rest converge on TTL expiry (≤30s).
 *
 * This is the FOUNDATION only. Migrating the ~13 env-reading capability guards onto
 * `resolveCapability` is a separate step (FLAG-06); nothing here changes existing behavior.
 *
 * Cache design (positive-only): we cache resolved values but NOT absence. There is no
 * hot-path consumer yet, so there is nothing to protect against DB-hammering, and negative
 * caching is exactly the interaction that burned PERF-01 (a transient failure frozen as a
 * false "absent"). A DB error therefore THROWS (never cached); Redis errors degrade to a
 * direct DB read (cache is best-effort). A negative cache can be added in FLAG-06 once the
 * real read pattern is known.
 */

export type SettingValue = Record<string, unknown>;

const CACHE_PREFIX = "settings:v1:";

/** TTL for cached settings. Bounds cross-instance staleness after a flip (FLAG-01 criterion: ≤30–60s). */
export const SETTINGS_CACHE_TTL_SEC = 30;

/** Setting keys for capability toggles live under this namespace, e.g. "capability:itsme". */
const CAPABILITY_SETTING_PREFIX = "capability:";

const cacheKey = (key: string) => `${CACHE_PREFIX}${key}`;

/** The `platform_settings.key` that holds the toggle for a capability. */
export function capabilitySettingKey(cap: Capability): string {
  return `${CAPABILITY_SETTING_PREFIX}${cap}`;
}

function logCacheError(op: string, key: string, err: unknown): void {
  if (process.env.NODE_ENV === "test") return;
  console.warn(`platform_settings cache ${op} failed for "${key}" (degrading):`, err);
}

/**
 * Read one setting's value. Redis-cached (positive-only); returns `null` when the key is
 * absent. Throws on a DB error — a transient failure must never be cached as "absent".
 */
export async function getSetting(key: string): Promise<SettingValue | null> {
  const redis = getRedis();

  if (redis) {
    try {
      const cached = await redis.get<SettingValue>(cacheKey(key));
      if (cached !== null && cached !== undefined) return cached;
    } catch (err) {
      logCacheError("get", key, err);
    }
  }

  const supabase = await supabaseService();
  const { data, error } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    // Throw — do NOT cache. The caller (e.g. resolveCapability) falls back to a safe default.
    throw new Error(`getSetting("${key}"): ${error.message}`);
  }

  const value = (data?.value ?? null) as SettingValue | null;

  if (redis && value !== null) {
    try {
      await redis.set(cacheKey(key), value, { ex: SETTINGS_CACHE_TTL_SEC });
    } catch (err) {
      logCacheError("set", key, err);
    }
  }

  return value;
}

/**
 * Upsert a setting (admin/service path) and invalidate its cache entry so the writing
 * instance sees the new value immediately; other instances converge within the TTL.
 * Throws on a DB error (the write must be durable before we report success).
 */
export async function setSetting(
  key: string,
  value: SettingValue,
  updatedBy?: string | null,
): Promise<void> {
  const supabase = await supabaseService();
  const { error } = await supabase
    .from("platform_settings")
    .upsert(
      { key, value: value as Json, updated_at: new Date().toISOString(), updated_by: updatedBy ?? null },
      { onConflict: "key" },
    );

  if (error) {
    throw new Error(`setSetting("${key}"): ${error.message}`);
  }

  await invalidateSetting(key);
}

/** Drop a setting's cache entry (best-effort). No-op when Redis is unavailable. */
export async function invalidateSetting(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(cacheKey(key));
  } catch (err) {
    logCacheError("del", key, err);
  }
}

/**
 * Async runtime resolver for a capability toggle. Reads `capability:<cap>` from
 * `platform_settings`; when that setting is absent OR any read fails, falls back to the
 * env default (`isCapabilityEnabled`). A config-store outage must never break a request —
 * it only degrades to the deploy-time default.
 *
 * NOTE: this does NOT yet gate on required secrets — that AND-gate (toggle && keysPresent)
 * is FLAG-02's `getIntegrationStatus`. Here we resolve the toggle half only.
 */
export async function resolveCapability(
  cap: Capability,
  env: Record<string, string | undefined> = process.env,
): Promise<boolean> {
  try {
    const value = await getSetting(capabilitySettingKey(cap));
    if (value && typeof value.enabled === "boolean") {
      return value.enabled;
    }
    return isCapabilityEnabled(cap, env);
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(`resolveCapability("${cap}") fell back to env default after error:`, err);
    }
    return isCapabilityEnabled(cap, env);
  }
}
