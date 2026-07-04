import { afterEach, describe, expect, it, vi } from "vitest";

// SEC-RL2: when Upstash keys are absent (no redisClient — the case in the test
// env, which sets no UPSTASH_* vars), the limiter must fail *closed* in a
// hard-fail (production) environment and stay a no-op elsewhere. We drive that
// decision by mocking isHardFailEnv rather than mutating NODE_ENV/VERCEL_ENV.
const hardFail = vi.hoisted(() => ({ value: false }));

vi.mock("@/lib/env", () => ({
  isHardFailEnv: () => hardFail.value,
}));

import { createRateLimiter } from "@/lib/rateLimiter";

afterEach(() => {
  hardFail.value = false;
});

describe("createRateLimiter without Upstash (SEC-RL2)", () => {
  it("is a no-op (fail-open) outside production", async () => {
    hardFail.value = false;
    const limiter = createRateLimiter({ limit: 5, windowSec: 60, prefix: "test" });
    const result = await limiter("user:1");
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(5);
    expect(result.retryAfterSec).toBe(0);
  });

  it("fails closed (429) in a hard-fail production environment", async () => {
    hardFail.value = true;
    const limiter = createRateLimiter({ limit: 5, windowSec: 60, prefix: "test" });
    const result = await limiter("user:1");
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
    // The 429 builder consumes these — they must be finite, not NaN.
    expect(result.retryAfterSec).toBe(60);
    expect(Number.isFinite(result.reset)).toBe(true);
    expect(result.reset).toBeGreaterThan(0);
  });
});
