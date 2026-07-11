import { describe, expect, it } from "vitest";
import {
  ACCESS_GATE_COOKIE_TTL_SECONDS,
  getAccessGateRuntime,
  issueAccessGateCookie,
  sanitizeAccessGateReturnTo,
  shouldProtectWithAccessGate,
  verifyAccessGateCode,
  verifyAccessGateCookie,
} from "@/lib/security/accessGate";

const ACCESS_CODE = "team-preview-code";
const SIGNING_SECRET = "s".repeat(48);
const TURNSTILE_ENV = {
  TURNSTILE_SECRET_KEY: "turnstile-secret",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site-key",
  UPSTASH_REDIS_REST_URL: "https://redis.example.com",
  UPSTASH_REDIS_REST_TOKEN: "redis-token",
};

describe("production access gate runtime", () => {
  it("is closed by default on production and publicly reachable Vercel previews", () => {
    expect(
      getAccessGateRuntime({
        VERCEL_ENV: "production",
        NODE_ENV: "production",
        PRODUCTION_ACCESS_CODE: ACCESS_CODE,
        PRODUCTION_ACCESS_GATE_SECRET: SIGNING_SECRET,
        ...TURNSTILE_ENV,
      }),
    ).toMatchObject({ active: true, configured: true });

    expect(
      getAccessGateRuntime({
        VERCEL_ENV: "preview",
        NODE_ENV: "production",
        PRODUCTION_ACCESS_CODE: ACCESS_CODE,
        PRODUCTION_ACCESS_GATE_SECRET: SIGNING_SECRET,
        ...TURNSTILE_ENV,
      }).active,
    ).toBe(true);

    expect(getAccessGateRuntime({ NODE_ENV: "development" }).active).toBe(
      false,
    );
    expect(getAccessGateRuntime({ NODE_ENV: "test" }).active).toBe(false);
  });

  it("opens production only when the release flag is explicitly false", () => {
    expect(
      getAccessGateRuntime({
        VERCEL_ENV: "production",
        PRODUCTION_ACCESS_GATE_ENABLED: "false",
      }).active,
    ).toBe(false);

    expect(
      getAccessGateRuntime({
        VERCEL_ENV: "preview",
        PRODUCTION_ACCESS_GATE_ENABLED: "false",
      }).active,
    ).toBe(true);
  });

  it("stays unconfigured when either credential is absent or the signing key is short", () => {
    expect(
      getAccessGateRuntime({
        VERCEL_ENV: "production",
        PRODUCTION_ACCESS_CODE: ACCESS_CODE,
        PRODUCTION_ACCESS_GATE_SECRET: "short",
        ...TURNSTILE_ENV,
      }).configured,
    ).toBe(false);
    expect(
      getAccessGateRuntime({
        VERCEL_ENV: "production",
        PRODUCTION_ACCESS_GATE_SECRET: SIGNING_SECRET,
        ...TURNSTILE_ENV,
      }).configured,
    ).toBe(false);
    expect(
      getAccessGateRuntime({
        VERCEL_ENV: "production",
        PRODUCTION_ACCESS_CODE: "short",
        PRODUCTION_ACCESS_GATE_SECRET: SIGNING_SECRET,
        ...TURNSTILE_ENV,
      }).configured,
    ).toBe(false);
  });

  it("stays locked when the required Turnstile pair is incomplete", () => {
    expect(
      getAccessGateRuntime({
        VERCEL_ENV: "production",
        PRODUCTION_ACCESS_CODE: ACCESS_CODE,
        PRODUCTION_ACCESS_GATE_SECRET: SIGNING_SECRET,
        TURNSTILE_SECRET_KEY: "turnstile-secret",
        UPSTASH_REDIS_REST_URL: "https://redis.example.com",
        UPSTASH_REDIS_REST_TOKEN: "redis-token",
      }).configured,
    ).toBe(false);
  });

  it("stays locked on previews when the distributed rate limiter is unavailable", () => {
    expect(
      getAccessGateRuntime({
        VERCEL_ENV: "preview",
        PRODUCTION_ACCESS_CODE: ACCESS_CODE,
        PRODUCTION_ACCESS_GATE_SECRET: SIGNING_SECRET,
        TURNSTILE_SECRET_KEY: "turnstile-secret",
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site-key",
      }),
    ).toMatchObject({
      active: true,
      configured: false,
      rateLimitConfigured: false,
    });
  });
});

describe("production access gate route boundary", () => {
  it("protects ordinary browser APIs and does not have an extension bypass", () => {
    expect(shouldProtectWithAccessGate("/api/search", "GET")).toBe(true);
    expect(shouldProtectWithAccessGate("/api/catalog.json", "GET")).toBe(true);
    expect(shouldProtectWithAccessGate("/private.json", "GET")).toBe(true);
    expect(shouldProtectWithAccessGate("/sitemap.xml", "GET")).toBe(true);
  });

  it("allows only method-specific machine endpoints and public boot assets", () => {
    expect(shouldProtectWithAccessGate("/api/access-gate/unlock", "POST")).toBe(
      false,
    );
    expect(shouldProtectWithAccessGate("/api/access-gate/unlock", "GET")).toBe(
      true,
    );
    expect(shouldProtectWithAccessGate("/api/billing/webhook", "POST")).toBe(
      false,
    );
    expect(shouldProtectWithAccessGate("/api/billing/webhook", "GET")).toBe(
      true,
    );
    expect(
      shouldProtectWithAccessGate("/api/cron/translate-adverts", "GET"),
    ).toBe(false);
    expect(
      shouldProtectWithAccessGate("/api/cron/translate-adverts", "HEAD"),
    ).toBe(true);
    expect(shouldProtectWithAccessGate("/api/cron/unlisted-task", "GET")).toBe(
      true,
    );
    expect(shouldProtectWithAccessGate("/auth/callback", "GET")).toBe(false);
    expect(shouldProtectWithAccessGate("/auth/callback", "HEAD")).toBe(true);
    expect(shouldProtectWithAccessGate("/auth/callback", "POST")).toBe(true);
    expect(shouldProtectWithAccessGate("/robots.txt", "GET")).toBe(false);
    expect(shouldProtectWithAccessGate("/lyvox.svg", "GET")).toBe(false);
    expect(shouldProtectWithAccessGate("/coming-soon/hidden", "GET")).toBe(
      true,
    );
  });
});

describe("production access gate cryptography", () => {
  it("compares the human code and rejects a different value", async () => {
    await expect(verifyAccessGateCode(ACCESS_CODE, ACCESS_CODE)).resolves.toBe(
      true,
    );
    await expect(
      verifyAccessGateCode(`${ACCESS_CODE}-wrong`, ACCESS_CODE),
    ).resolves.toBe(false);
  });

  it("issues an opaque HMAC cookie using the independent signing secret", async () => {
    const now = Date.UTC(2026, 6, 11, 12, 0, 0);
    const token = await issueAccessGateCookie(SIGNING_SECRET, now);

    expect(token).not.toContain(ACCESS_CODE);
    expect(token).not.toContain(SIGNING_SECRET);
    await expect(
      verifyAccessGateCookie(token, SIGNING_SECRET, now + 1_000),
    ).resolves.toBe(true);
    await expect(
      verifyAccessGateCookie(token, ACCESS_CODE, now + 1_000),
    ).resolves.toBe(false);
  });

  it("rejects tampered and expired cookies", async () => {
    const now = Date.UTC(2026, 6, 11, 12, 0, 0);
    const token = await issueAccessGateCookie(SIGNING_SECRET, now);
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    await expect(
      verifyAccessGateCookie(tampered, SIGNING_SECRET, now),
    ).resolves.toBe(false);
    await expect(
      verifyAccessGateCookie(
        token,
        SIGNING_SECRET,
        now + ACCESS_GATE_COOKIE_TTL_SECONDS * 1_000,
      ),
    ).resolves.toBe(false);
  });
});

describe("access gate return path", () => {
  it("keeps only a safe internal pathname and drops query or fragment secrets", () => {
    expect(sanitizeAccessGateReturnTo("/auth/callback?code=secret#state")).toBe(
      "/auth/callback",
    );
    expect(sanitizeAccessGateReturnTo("/en/search?q=chair")).toBe("/en/search");
  });

  it("rejects external, protocol-relative, control, and gate-loop destinations", () => {
    expect(sanitizeAccessGateReturnTo("https://evil.example/path")).toBe("/");
    expect(sanitizeAccessGateReturnTo("//evil.example/path")).toBe("/");
    expect(sanitizeAccessGateReturnTo("/%2f%2fevil.example")).toBe("/");
    expect(sanitizeAccessGateReturnTo("/foo/..//evil.example")).toBe("/");
    expect(sanitizeAccessGateReturnTo("/coming-soon?returnTo=/search")).toBe(
      "/",
    );
  });
});
