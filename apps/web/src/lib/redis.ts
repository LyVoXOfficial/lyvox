import { Redis } from "@upstash/redis";

let cached: Redis | null | undefined;

/**
 * Shared Upstash Redis (REST) client, memoized for the process lifetime, or `null`
 * when credentials are absent (local dev / test / preview without Upstash).
 *
 * Callers MUST treat `null` — and any thrown error from the returned client — as
 * "cache unavailable" and degrade gracefully (read the source of truth, don't 500).
 * Redis here is a best-effort cache, never the system of record.
 */
export function getRedis(): Redis | null {
  if (cached === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    cached = url && token ? new Redis({ url, token }) : null;
  }
  return cached;
}

/** Test-only: reset the memoized client so a fresh env is picked up. */
export function __resetRedisForTest(): void {
  cached = undefined;
}
