import "server-only";

import { getRedis } from "@/lib/redis";
import { supabaseService } from "@/lib/supabaseService";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  DEFAULT_LAUNCH_MODE,
  isCapabilityEnabled,
  isLaunchMode,
  isFailClosedCapability,
  type Capability,
  type LaunchMode,
} from "@/lib/capabilities";
import type { Json } from "@/lib/supabaseTypes";

/**
 * FLAG-01 · Runtime-config resolver.
 *
 * Reads non-secret toggles/config from the `platform_settings` table behind a short-TTL
 * Upstash cache with explicit invalidation on write. Because Upstash is shared across all
 * Fluid Compute instances, a toggle flip propagates to every instance within the TTL — the
 * writer's instance is immediate (explicit del), the rest converge on TTL expiry (≤30s).
 *
 * All production capability decisions pass through the async integration registry,
 * which combines this runtime control with keys, approvals, launch mode and health.
 *
 * Cache design (positive-only): we cache resolved values but NOT absence. There is no
 * hot-path consumer yet, so there is nothing to protect against DB-hammering, and negative
 * caching is exactly the interaction that burned PERF-01 (a transient failure frozen as a
 * false "absent"). A DB error therefore THROWS (never cached); Redis errors degrade to a
 * direct DB read (cache is best-effort). A negative cache can be added in FLAG-06 once the
 * real read pattern is known.
 */

export type SettingValue = Record<string, unknown>;
export type SettingRecord = {
  key: string;
  value: SettingValue;
  revision: number;
  updatedAt: string;
  updatedBy: string | null;
};

const CACHE_PREFIX = "settings:v2:";
const COMMERCIAL_BLOCKED_CACHE_KEY = `${CACHE_PREFIX}safe:commercial-blocked`;

/** TTL for cached settings. Bounds cross-instance staleness after a flip (FLAG-01 criterion: ≤30–60s). */
export const SETTINGS_CACHE_TTL_SEC = 30;

/** Setting keys for capability toggles live under this namespace, e.g. "capability:itsme". */
const CAPABILITY_SETTING_PREFIX = "capability:";

/** Global commercial posture. Any missing/invalid/unavailable value resolves to contact_only. */
export const LAUNCH_MODE_SETTING_KEY = "platform.launch_mode";
export const MONEY_EMERGENCY_STOP_SETTING_KEY = "platform.money_emergency_stop";
export const STRIPE_RECONCILIATION_SETTING_KEY =
  "platform.stripe_reconciliation";

const cacheKey = (key: string) => `${CACHE_PREFIX}${key}`;

/**
 * These values are authorization/activation evidence. A cache credential must
 * never become equivalent to the audited AAL2 control plane, and a stale
 * cache-aside fill must never resurrect an emergency-disabled value.
 */
export function isIntegrityCriticalSettingKey(key: string): boolean {
  return (
    key.startsWith("platform.") ||
    key.startsWith(CAPABILITY_SETTING_PREFIX) ||
    key.startsWith("approval:")
  );
}

/** The `platform_settings.key` that holds the toggle for a capability. */
export function capabilitySettingKey(cap: Capability): string {
  return `${CAPABILITY_SETTING_PREFIX}${cap}`;
}

function logCacheError(op: string, key: string, err: unknown): void {
  if (process.env.NODE_ENV === "test") return;
  console.warn(
    `platform_settings cache ${op} failed for "${key}" (degrading):`,
    err,
  );
}

/**
 * Read one setting's value. Redis-cached (positive-only); returns `null` when the key is
 * absent. Throws on a DB error — a transient failure must never be cached as "absent".
 */
export async function getSettingRecord(
  key: string,
): Promise<SettingRecord | null> {
  const redis = isIntegrityCriticalSettingKey(key) ? null : getRedis();

  if (redis) {
    try {
      const cached = await redis.get<SettingRecord>(cacheKey(key));
      if (cached !== null && cached !== undefined) return cached;
    } catch (err) {
      logCacheError("get", key, err);
    }
  }

  const supabase = await supabaseService();
  const { data, error } = await supabase
    .from("platform_settings")
    .select("key, value, revision, updated_at, updated_by")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    // Throw — do NOT cache. The caller (e.g. resolveCapability) falls back to a safe default.
    throw new Error(`getSetting("${key}"): ${error.message}`);
  }

  const record = data
    ? {
        key: data.key,
        value: data.value as SettingValue,
        revision: data.revision,
        updatedAt: data.updated_at,
        updatedBy: data.updated_by,
      }
    : null;

  if (redis && record !== null) {
    try {
      await redis.set(cacheKey(key), record, { ex: SETTINGS_CACHE_TTL_SEC });
    } catch (err) {
      logCacheError("set", key, err);
    }
  }

  return record;
}

export async function getSetting(key: string): Promise<SettingValue | null> {
  return (await getSettingRecord(key))?.value ?? null;
}

/**
 * One DB-authoritative snapshot for a request that needs several control-plane
 * values. Integrity-critical settings deliberately never come from Redis.
 */
export async function getSettingRecords(
  keys: readonly string[],
): Promise<Map<string, SettingRecord>> {
  const uniqueKeys = Array.from(new Set(keys));
  if (uniqueKeys.length === 0) return new Map();

  const supabase = await supabaseService();
  const { data, error } = await supabase
    .from("platform_settings")
    .select("key, value, revision, updated_at, updated_by")
    .in("key", uniqueKeys);

  if (error) {
    throw new Error(`getSettingRecords(): ${error.message}`);
  }

  return new Map(
    (data ?? []).map((row) => [
      row.key,
      {
        key: row.key,
        value: row.value as SettingValue,
        revision: row.revision,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
      },
    ]),
  );
}

export type CommercialBoundary = {
  launchMode: LaunchMode;
  reconciliationEnabled: boolean;
  configAvailable: boolean;
};

/**
 * Cheap webhook entry boundary. Redis may cache only the strictly safer blocked
 * state; an injected/old value can delay activation but can never open money.
 */
export async function getCommercialBoundary(): Promise<CommercialBoundary> {
  const redis = getRedis();
  if (redis) {
    try {
      if ((await redis.get<boolean>(COMMERCIAL_BLOCKED_CACHE_KEY)) === true) {
        return {
          launchMode: DEFAULT_LAUNCH_MODE,
          reconciliationEnabled: false,
          configAvailable: true,
        };
      }
    } catch (err) {
      logCacheError("get", COMMERCIAL_BLOCKED_CACHE_KEY, err);
    }
  }

  try {
    const records = await getSettingRecords([
      LAUNCH_MODE_SETTING_KEY,
      STRIPE_RECONCILIATION_SETTING_KEY,
    ]);
    const mode = records.get(LAUNCH_MODE_SETTING_KEY)?.value.mode;
    const launchMode = isLaunchMode(mode) ? mode : DEFAULT_LAUNCH_MODE;
    const reconciliationEnabled =
      records.get(STRIPE_RECONCILIATION_SETTING_KEY)?.value.enabled === true;

    if (redis && launchMode === DEFAULT_LAUNCH_MODE && !reconciliationEnabled) {
      try {
        await redis.set(COMMERCIAL_BLOCKED_CACHE_KEY, true, {
          ex: SETTINGS_CACHE_TTL_SEC,
        });
      } catch (err) {
        logCacheError("set", COMMERCIAL_BLOCKED_CACHE_KEY, err);
      }
    }

    return { launchMode, reconciliationEnabled, configAvailable: true };
  } catch {
    return {
      launchMode: DEFAULT_LAUNCH_MODE,
      reconciliationEnabled: false,
      configAvailable: false,
    };
  }
}

/**
 * Upsert a setting (admin/service path) and invalidate its cache entry so the writing
 * instance sees the new value immediately; other instances converge within the TTL.
 * Throws on a DB error (the write must be durable before we report success).
 */
export async function setSetting(
  key: string,
  value: SettingValue,
  context: {
    reason: string;
    expectedRevision: number;
    requestId?: string | null;
  },
): Promise<number> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("set_platform_setting", {
    p_key: key,
    p_value: value as Json,
    p_reason: context.reason,
    p_expected_revision: context.expectedRevision,
    ...(context.requestId == null ? {} : { p_request_id: context.requestId }),
  });

  if (error) {
    throw new Error(`setSetting("${key}"): ${error.message}`);
  }

  await invalidateSetting(key);
  return Number(data);
}

/** Monotonic, atomic emergency activation that patches the latest DB value. */
export async function activateEmergencyStop(
  key: string,
  context: { reason: string; requestId?: string | null },
): Promise<number> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc(
    "activate_platform_emergency_stop",
    {
      p_key: key,
      p_reason: context.reason,
      ...(context.requestId == null ? {} : { p_request_id: context.requestId }),
    },
  );

  if (error) {
    throw new Error(`activateEmergencyStop("${key}"): ${error.message}`);
  }

  await invalidateSetting(key);
  return Number(data);
}

/**
 * Resolve the global launch mode. This value is deliberately DB-only and
 * fail-closed: no environment variable can accidentally activate a money mode.
 */
export async function getLaunchMode(): Promise<LaunchMode> {
  try {
    const value = await getSetting(LAUNCH_MODE_SETTING_KEY);
    return isLaunchMode(value?.mode) ? value.mode : DEFAULT_LAUNCH_MODE;
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "getLaunchMode() fell back to contact_only after settings error:",
        err,
      );
    }
    return DEFAULT_LAUNCH_MODE;
  }
}

export type CapabilityControlResolution = {
  desired: boolean;
  emergencyDisabled: boolean;
  configAvailable: boolean;
  source: "runtime" | "environment" | "safe_default";
};

/**
 * Resolve both the requested state and the per-capability emergency switch.
 * Sensitive capabilities use a safe OFF default whenever runtime config is
 * missing, malformed, or unavailable.
 */
export async function resolveCapabilityControl(
  cap: Capability,
  env: Record<string, string | undefined> = process.env,
): Promise<CapabilityControlResolution> {
  const safeFallback = () =>
    isFailClosedCapability(cap)
      ? { desired: false, source: "safe_default" as const }
      : {
          desired: isCapabilityEnabled(cap, env),
          source: "environment" as const,
        };

  try {
    const value = await getSetting(capabilitySettingKey(cap));
    if (value && typeof value.enabled === "boolean") {
      return {
        desired: value.enabled,
        emergencyDisabled: value.emergencyDisabled === true,
        configAvailable: true,
        source: "runtime",
      };
    }
    const fallback = safeFallback();
    return {
      ...fallback,
      emergencyDisabled: value?.emergencyDisabled === true,
      configAvailable: true,
    };
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        `resolveCapabilityControl("${cap}") used a safe fallback after error:`,
        err,
      );
    }
    const fallback = safeFallback();
    return {
      ...fallback,
      emergencyDisabled: false,
      configAvailable: false,
    };
  }
}

/** Global, fail-closed money kill switch. Missing or unreadable means STOP. */
export async function getMoneyEmergencyStop(): Promise<{
  stopped: boolean;
  configAvailable: boolean;
}> {
  try {
    const value = await getSetting(MONEY_EMERGENCY_STOP_SETTING_KEY);
    return {
      stopped: value?.stopped !== false,
      configAvailable: true,
    };
  } catch {
    return { stopped: true, configAvailable: false };
  }
}

/**
 * Signed Stripe reconciliation is a separate lifecycle from opening new sales.
 * It starts OFF and is enabled only when the first paid mode is deliberately
 * activated; afterwards it may remain ON during an emergency sales stop so
 * cancellations and failures for known internal records are still reconciled.
 */
export async function getStripeReconciliationEnabled(): Promise<boolean> {
  try {
    const value = await getSetting(STRIPE_RECONCILIATION_SETTING_KEY);
    return value?.enabled === true;
  } catch {
    return false;
  }
}

/** Drop a setting's cache entry (best-effort). No-op when Redis is unavailable. */
export async function invalidateSetting(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(cacheKey(key));
    if (
      key === LAUNCH_MODE_SETTING_KEY ||
      key === STRIPE_RECONCILIATION_SETTING_KEY
    ) {
      await redis.del(COMMERCIAL_BLOCKED_CACHE_KEY);
    }
  } catch (err) {
    logCacheError("del", key, err);
  }
}

/**
 * Async runtime resolver for a capability toggle. Reads `capability:<cap>` from
 * `platform_settings`; non-money capabilities fall back to their deploy-time env default
 * when the setting is absent or unavailable. Money capabilities are deliberately
 * fail-closed and require an explicit runtime setting, so keys or env flags alone can
 * never activate a charge path.
 *
 * This helper resolves only the toggle half. Production call sites use
 * `getIntegrationStatus`, which adds keys, approvals, launch mode and health.
 */
export async function resolveCapability(
  cap: Capability,
  env: Record<string, string | undefined> = process.env,
): Promise<boolean> {
  const control = await resolveCapabilityControl(cap, env);
  return control.desired && !control.emergencyDisabled;
}
