import { describe, it, expect, beforeEach, vi } from "vitest";

const verifyTurnstileMock = vi.fn();

vi.mock("@/lib/antifraud/turnstile", () => ({
  verifyTurnstile: verifyTurnstileMock,
}));

// Bypass the rate-limiter wrapper so POST === baseHandler for testing.
vi.mock("@/lib/rateLimiter", () => ({
  createRateLimiter: () => async () => ({ success: true }),
  withRateLimit: (h: unknown) => h,
  getClientIp: () => "1.2.3.4",
}));

const { POST } = await import("../route");

function jsonReq(body: unknown) {
  return new Request("https://x.test/api/antifraud/verify-captcha", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/antifraud/verify-captcha", () => {
  beforeEach(() => {
    verifyTurnstileMock.mockReset();
  });

  it("200 ok when verifyTurnstile succeeds", async () => {
    verifyTurnstileMock.mockResolvedValue({ ok: true });
    const res = await POST(jsonReq({ token: "good-token" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("200 ok when Turnstile is unconfigured (skipped)", async () => {
    verifyTurnstileMock.mockResolvedValue({ ok: true, skipped: true });
    const res = await POST(jsonReq({ token: "anything" }));
    expect(res.status).toBe(200);
  });

  it("403 CAPTCHA_FAILED when verifyTurnstile fails", async () => {
    verifyTurnstileMock.mockResolvedValue({ ok: false, codes: ["invalid-input-response"] });
    const res = await POST(jsonReq({ token: "bad-token" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("CAPTCHA_FAILED");
  });

  it("400 when token is missing from payload", async () => {
    const res = await POST(jsonReq({}));
    expect(res.status).toBe(400);
    expect(verifyTurnstileMock).not.toHaveBeenCalled();
  });
});
