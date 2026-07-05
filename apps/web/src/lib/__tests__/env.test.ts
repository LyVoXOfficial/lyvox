import { afterEach, describe, expect, it, vi } from "vitest";
import { assertEnvOnBoot, isHardFailEnv, validateEnv } from "@/lib/env";

// A minimal env that satisfies every critical key so we can knock them out
// one at a time. Values are placeholders — validateEnv only checks presence.
const FULL_PROD_ENV: Record<string, string | undefined> = {
  VERCEL_ENV: "production",
  NODE_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  UPSTASH_REDIS_REST_URL: "https://x.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "token",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isHardFailEnv", () => {
  it("hard-fails on Vercel production", () => {
    expect(isHardFailEnv({ VERCEL_ENV: "production", NODE_ENV: "production" })).toBe(true);
  });

  it("does NOT hard-fail on Vercel preview (previews may lack Upstash)", () => {
    expect(isHardFailEnv({ VERCEL_ENV: "preview", NODE_ENV: "production" })).toBe(false);
  });

  it("does NOT hard-fail on Vercel development", () => {
    expect(isHardFailEnv({ VERCEL_ENV: "development", NODE_ENV: "production" })).toBe(false);
  });

  it("hard-fails on self-hosted production (no VERCEL_ENV)", () => {
    expect(isHardFailEnv({ NODE_ENV: "production" })).toBe(true);
  });

  it("does NOT hard-fail in dev or test", () => {
    expect(isHardFailEnv({ NODE_ENV: "development" })).toBe(false);
    expect(isHardFailEnv({ NODE_ENV: "test" })).toBe(false);
  });
});

describe("validateEnv", () => {
  it("is ok when all critical keys are present in production", () => {
    const r = validateEnv(FULL_PROD_ENV);
    expect(r.ok).toBe(true);
    expect(r.missingCritical).toEqual([]);
  });

  it("flags missing always-critical Supabase keys", () => {
    const r = validateEnv({ ...FULL_PROD_ENV, SUPABASE_SERVICE_ROLE_KEY: undefined });
    expect(r.ok).toBe(false);
    expect(r.missingCritical).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("flags missing Upstash keys as critical in production (SEC-RL2)", () => {
    const r = validateEnv({
      ...FULL_PROD_ENV,
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
    });
    expect(r.ok).toBe(false);
    expect(r.missingCritical).toContain("UPSTASH_REDIS_REST_URL");
    expect(r.missingCritical).toContain("UPSTASH_REDIS_REST_TOKEN");
  });

  it("treats Upstash as NON-critical outside production (dev convenience)", () => {
    const r = validateEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
    });
    expect(r.missingCritical).not.toContain("UPSTASH_REDIS_REST_URL");
  });

  it("reports missing optional keys as warnings, never critical", () => {
    const r = validateEnv({ ...FULL_PROD_ENV, STRIPE_SECRET_KEY: undefined });
    expect(r.missingCritical).not.toContain("STRIPE_SECRET_KEY");
    expect(r.warnings.some((w) => w.includes("STRIPE_SECRET_KEY"))).toBe(true);
  });

  it("warns on a present-but-invalid value without hard-failing (shape is advisory)", () => {
    const r = validateEnv({ ...FULL_PROD_ENV, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" });
    // Presence is the boot gate; a malformed value is a warning, not a block.
    expect(r.missingCritical).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.includes("NEXT_PUBLIC_SUPABASE_URL") && w.includes("invalid"))).toBe(
      true,
    );
  });

  it("treats a whitespace-only critical value as missing (isBlank trims)", () => {
    const r = validateEnv({ ...FULL_PROD_ENV, SUPABASE_SERVICE_ROLE_KEY: "   " });
    expect(r.missingCritical).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(r.ok).toBe(false);
  });

  it("carries the hardFail decision derived from the env", () => {
    expect(validateEnv({ ...FULL_PROD_ENV }).hardFail).toBe(true);
    expect(validateEnv({ ...FULL_PROD_ENV, VERCEL_ENV: "preview" }).hardFail).toBe(false);
  });

  it("SEC-ENV: warns when STRIPE_SECRET_KEY is a full-access key, not a restricted one", () => {
    const r = validateEnv({ ...FULL_PROD_ENV, STRIPE_SECRET_KEY: "sk_live_abc123" });
    expect(r.ok).toBe(true); // advisory only — never blocks boot
    expect(r.warnings.some((w) => w.includes("STRIPE_SECRET_KEY") && w.includes("restricted"))).toBe(
      true,
    );
  });

  it("SEC-ENV: does NOT warn when STRIPE_SECRET_KEY is already a restricted key", () => {
    const r = validateEnv({ ...FULL_PROD_ENV, STRIPE_SECRET_KEY: "rk_live_abc123" });
    expect(r.warnings.some((w) => w.includes("restricted"))).toBe(false);
  });
});

describe("assertEnvOnBoot", () => {
  it("throws in production when a critical key is missing", () => {
    expect(() =>
      assertEnvOnBoot({ ...FULL_PROD_ENV, UPSTASH_REDIS_REST_URL: undefined }),
    ).toThrow(/UPSTASH_REDIS_REST_URL/);
  });

  it("does NOT throw in production when everything critical is present", () => {
    expect(() => assertEnvOnBoot(FULL_PROD_ENV)).not.toThrow();
  });

  it("warns instead of throwing in development", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      assertEnvOnBoot({ NODE_ENV: "development", NEXT_PUBLIC_SUPABASE_URL: undefined }),
    ).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });

  it("does NOT throw on Vercel preview even with Upstash missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      assertEnvOnBoot({
        VERCEL_ENV: "preview",
        NODE_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service",
      }),
    ).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });
});
