import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyAccessGateCookie } from "@/lib/security/accessGate";

const limiter = vi.hoisted(() => ({
  result: {
    success: true,
    limit: 8,
    remaining: 7,
    reset: 0,
    retryAfterSec: 0,
  },
}));

const turnstile = vi.hoisted(() => ({
  verify: vi.fn(),
}));

vi.mock("@/lib/rateLimiter", () => ({
  createRateLimiter: () => async () => limiter.result,
  getClientIp: () => "203.0.113.8",
}));

vi.mock("@/lib/antifraud/turnstile", () => ({
  verifyTurnstile: turnstile.verify,
}));

import { POST as lock } from "@/app/api/access-gate/lock/route";
import { POST as unlock } from "@/app/api/access-gate/unlock/route";
import { readAccessGateForm } from "@/app/api/access-gate/_shared";

const ACCESS_CODE = "team-preview-code";
const SIGNING_SECRET = "z".repeat(48);

function configureClosedProduction() {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("PRODUCTION_ACCESS_GATE_ENABLED", "true");
  vi.stubEnv("PRODUCTION_ACCESS_CODE", ACCESS_CODE);
  vi.stubEnv("PRODUCTION_ACCESS_GATE_SECRET", SIGNING_SECRET);
  vi.stubEnv("TURNSTILE_SECRET_KEY", "turnstile-secret");
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "turnstile-site-key");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "redis-token");
}

function formRequest(
  path: string,
  fields: Record<string, string>,
  origin: string | null = "https://www.lyvox.be",
) {
  const headers = new Headers({
    host: "www.lyvox.be",
    "content-type": "application/x-www-form-urlencoded",
  });
  if (origin) headers.set("origin", origin);
  return new Request(`https://www.lyvox.be${path}`, {
    method: "POST",
    headers,
    body: new URLSearchParams({ turnstileToken: "turnstile-token", ...fields }),
  });
}

beforeEach(() => {
  configureClosedProduction();
  limiter.result = {
    success: true,
    limit: 8,
    remaining: 7,
    reset: 0,
    retryAfterSec: 0,
  };
  turnstile.verify.mockReset();
  turnstile.verify.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/access-gate/unlock", () => {
  it("requires a same-origin browser POST", async () => {
    const crossOrigin = await unlock(
      formRequest(
        "/api/access-gate/unlock",
        { code: ACCESS_CODE },
        "https://evil.example",
      ),
    );
    const missingOrigin = await unlock(
      formRequest("/api/access-gate/unlock", { code: ACCESS_CODE }, null),
    );
    const wrongScheme = await unlock(
      formRequest(
        "/api/access-gate/unlock",
        { code: ACCESS_CODE },
        "http://www.lyvox.be",
      ),
    );

    expect(crossOrigin.status).toBe(403);
    expect(missingOrigin.status).toBe(403);
    expect(wrongScheme.status).toBe(403);
  });

  it("does not unlock a Vercel preview without the distributed limiter", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("PRODUCTION_ACCESS_GATE_ENABLED", "false");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const response = await unlock(
      formRequest("/api/access-gate/unlock", { code: ACCESS_CODE }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("error=unavailable");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(turnstile.verify).not.toHaveBeenCalled();
  });

  it("rejects an invalid code without setting a cookie", async () => {
    const response = await unlock(
      formRequest("/api/access-gate/unlock", {
        code: "wrong-code",
        returnTo: "/en/search",
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("error=invalid");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("sets an opaque hardened cookie and redirects only to a safe pathname", async () => {
    const response = await unlock(
      formRequest("/api/access-gate/unlock", {
        code: ACCESS_CODE,
        returnTo: "/en/search?code=must-not-survive#fragment",
      }),
    );

    const setCookie = response.headers.get("set-cookie") ?? "";
    const token = /__Host-lyvox-preview=([^;]+)/u.exec(setCookie)?.[1];
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://www.lyvox.be/en/search",
    );
    expect(setCookie).toMatch(/HttpOnly/iu);
    expect(setCookie).toMatch(/Secure/iu);
    expect(setCookie).toMatch(/SameSite=lax/iu);
    expect(setCookie).toMatch(/Path=\//u);
    expect(setCookie).not.toContain(ACCESS_CODE);
    expect(token).toBeTruthy();
    await expect(verifyAccessGateCookie(token, SIGNING_SECRET)).resolves.toBe(
      true,
    );
    await expect(verifyAccessGateCookie(token, ACCESS_CODE)).resolves.toBe(
      false,
    );
    expect(turnstile.verify).toHaveBeenCalledWith(
      "turnstile-token",
      "203.0.113.8",
      {
        required: true,
        expectedAction: "access_gate_unlock",
        expectedHostname: "www.lyvox.be",
      },
    );
  });

  it("requires a successful Turnstile action and hostname verification", async () => {
    turnstile.verify.mockResolvedValue({
      ok: false,
      codes: ["action-mismatch"],
    });

    const response = await unlock(
      formRequest("/api/access-gate/unlock", { code: ACCESS_CODE }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("error=captcha");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rate-limits attempts and never verifies the code on a missing configuration", async () => {
    limiter.result = {
      success: false,
      limit: 8,
      remaining: 0,
      reset: 100,
      retryAfterSec: 60,
    };
    const limited = await unlock(
      new Request("https://www.lyvox.be/api/access-gate/unlock", {
        method: "POST",
        headers: {
          host: "www.lyvox.be",
          origin: "https://www.lyvox.be",
          "content-type": "multipart/form-data; boundary=attacker",
        },
        body: "not-a-valid-form",
      }),
    );
    expect(limited.headers.get("location")).toContain("error=rate_limited");
    expect(limited.headers.get("retry-after")).toBe("60");

    vi.stubEnv("PRODUCTION_ACCESS_GATE_SECRET", "too-short");
    const unavailable = await unlock(
      formRequest("/api/access-gate/unlock", { code: ACCESS_CODE }),
    );
    expect(unavailable.headers.get("location")).toContain("error=unavailable");
    expect(unavailable.headers.get("set-cookie")).toBeNull();
  });

  it("rejects an external returnTo even when the code is valid", async () => {
    const response = await unlock(
      formRequest("/api/access-gate/unlock", {
        code: ACCESS_CODE,
        returnTo: "https://evil.example/steal",
      }),
    );

    expect(response.headers.get("location")).toBe("https://www.lyvox.be/");
  });
});

describe("access gate form parser", () => {
  it("accepts only urlencoded forms and enforces the real byte limit", async () => {
    const multipart = new Request(
      "https://www.lyvox.be/api/access-gate/unlock",
      {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=x" },
        body: "--x--",
      },
    );
    const oversized = new Request(
      "https://www.lyvox.be/api/access-gate/unlock",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `code=${"a".repeat(5_000)}`,
      },
    );

    await expect(readAccessGateForm(multipart)).resolves.toBeNull();
    await expect(readAccessGateForm(oversized)).resolves.toBeNull();
  });
});

describe("POST /api/access-gate/lock", () => {
  it("clears the hardened cookie and returns to the holding page", async () => {
    const response = await lock(
      formRequest("/api/access-gate/lock", {
        returnTo: "/en/profile?token=secret",
      }),
    );
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://www.lyvox.be/coming-soon?returnTo=%2Fen%2Fprofile",
    );
    expect(setCookie).toMatch(/__Host-lyvox-preview=/u);
    expect(setCookie).toMatch(/Max-Age=0/iu);
    expect(setCookie).toMatch(/HttpOnly/iu);
    expect(setCookie).toMatch(/Secure/iu);
    expect(setCookie).toMatch(/SameSite=lax/iu);
  });
});
