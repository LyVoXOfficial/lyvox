import { describe, it, expect } from "vitest";
import { getClientIp } from "@/lib/rateLimiter";

function req(headers: Record<string, string>, ip?: string): Request {
  const r = new Request("https://x.test/", { headers });
  if (ip !== undefined) {
    Object.defineProperty(r, "ip", { value: ip });
  }
  return r;
}

describe("getClientIp — F8 trusted-source priority", () => {
  // ── Primary: x-vercel-forwarded-for ──────────────────────────────────────
  it("returns x-vercel-forwarded-for when present", () => {
    expect(
      getClientIp(req({ "x-vercel-forwarded-for": "1.2.3.4" }))
    ).toBe("1.2.3.4");
  });

  it("x-vercel-forwarded-for wins over x-forwarded-for (spoof attempt ignored)", () => {
    expect(
      getClientIp(
        req({
          "x-vercel-forwarded-for": "1.2.3.4",
          "x-forwarded-for": "attacker.evil.com, 10.0.0.1",
        })
      )
    ).toBe("1.2.3.4");
  });

  // ── Secondary: request.ip ─────────────────────────────────────────────────
  it("falls back to request.ip when x-vercel-forwarded-for is absent", () => {
    expect(getClientIp(req({}, "5.6.7.8"))).toBe("5.6.7.8");
  });

  it("request.ip wins over x-forwarded-for", () => {
    expect(
      getClientIp(req({ "x-forwarded-for": "attacker.evil.com" }, "5.6.7.8"))
    ).toBe("5.6.7.8");
  });

  // ── Tertiary: x-forwarded-for (non-Vercel fallback) ──────────────────────
  it("falls back to x-forwarded-for when Vercel headers and request.ip are absent", () => {
    expect(
      getClientIp(req({ "x-forwarded-for": "9.10.11.12, 10.0.0.1" }))
    ).toBe("9.10.11.12");
  });

  // ── No IP at all ──────────────────────────────────────────────────────────
  it("returns null when no IP source is available", () => {
    expect(getClientIp(req({}))).toBeNull();
  });

  it("ignores empty x-vercel-forwarded-for and falls through", () => {
    expect(
      getClientIp(req({ "x-vercel-forwarded-for": "  " }, "5.6.7.8"))
    ).toBe("5.6.7.8");
  });
});
