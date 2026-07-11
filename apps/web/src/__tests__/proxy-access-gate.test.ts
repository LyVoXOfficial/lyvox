import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
// Next 16 renamed the runtime convention to Proxy, but 16.2.10 still exports
// the matcher test helper under its compatibility name.
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { issueAccessGateCookie } from "@/lib/security/accessGate";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

import { config, proxy } from "@/proxy";

const ACCESS_CODE = "team-preview-code";
const SIGNING_SECRET = "k".repeat(48);

function configureClosedProduction() {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("PRODUCTION_ACCESS_GATE_ENABLED", "true");
  vi.stubEnv("PRODUCTION_ACCESS_CODE", ACCESS_CODE);
  vi.stubEnv("PRODUCTION_ACCESS_GATE_SECRET", SIGNING_SECRET);
  vi.stubEnv("TURNSTILE_SECRET_KEY", "turnstile-secret");
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "turnstile-site-key");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "redis-token");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
}

beforeEach(() => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  mocks.createServerClient.mockReturnValue({
    auth: { getUser: mocks.getUser },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("Next proxy production access boundary", () => {
  it("fails closed when production credentials are missing", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PRODUCTION_ACCESS_GATE_ENABLED", "true");

    const uiResponse = await proxy(
      new NextRequest("https://www.lyvox.be/en/search"),
    );
    const apiResponse = await proxy(
      new NextRequest("https://www.lyvox.be/api/search"),
    );

    expect(uiResponse.status).toBe(307);
    expect(uiResponse.headers.get("location")).toContain("/coming-soon");
    expect(apiResponse.status).toBe(503);
    await expect(apiResponse.json()).resolves.toMatchObject({
      error: "ACCESS_GATE_UNAVAILABLE",
    });
  });

  it("redirects a UI GET to the holding page before Supabase is touched", async () => {
    configureClosedProduction();
    const response = await proxy(
      new NextRequest("https://www.lyvox.be/en/search?q=private-value"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://www.lyvox.be/coming-soon?returnTo=%2Fen%2Fsearch",
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it("returns an error for ordinary APIs and non-read requests instead of redirecting", async () => {
    configureClosedProduction();

    const apiResponse = await proxy(
      new NextRequest("https://www.lyvox.be/api/catalog.json", {
        method: "GET",
      }),
    );
    const postResponse = await proxy(
      new NextRequest("https://www.lyvox.be/en/search", { method: "POST" }),
    );

    expect(apiResponse.status).toBe(401);
    await expect(apiResponse.json()).resolves.toMatchObject({
      error: "ACCESS_GATE_REQUIRED",
    });
    expect(postResponse.status).toBe(403);
    expect(postResponse.headers.get("location")).toBeNull();
  });

  it("keeps the sitemap private while robots remains reachable", async () => {
    configureClosedProduction();

    const sitemapResponse = await proxy(
      new NextRequest("https://www.lyvox.be/sitemap.xml"),
    );
    const robotsResponse = await proxy(
      new NextRequest("https://www.lyvox.be/robots.txt"),
    );

    expect(sitemapResponse.status).toBe(404);
    expect(robotsResponse.status).toBe(200);
  });

  it("serves a localized holding page without redirecting it back to itself", async () => {
    configureClosedProduction();

    const response = await proxy(
      new NextRequest("https://www.lyvox.be/nl/coming-soon"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("never touches Supabase on the holding page even with a forged auth cookie", async () => {
    configureClosedProduction();

    const response = await proxy(
      new NextRequest("https://www.lyvox.be/coming-soon", {
        headers: { cookie: "sb-forged-session=attacker-controlled" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("allows only the exact machine route and method combinations", async () => {
    configureClosedProduction();

    const webhookPost = await proxy(
      new NextRequest("https://www.lyvox.be/api/billing/webhook", {
        method: "POST",
      }),
    );
    const webhookGet = await proxy(
      new NextRequest("https://www.lyvox.be/api/billing/webhook", {
        method: "GET",
      }),
    );
    const callbackGet = await proxy(
      new NextRequest("https://www.lyvox.be/auth/callback", { method: "GET" }),
    );
    const localizedWebhook = await proxy(
      new NextRequest("https://www.lyvox.be/nl/api/billing/webhook", {
        method: "POST",
      }),
    );

    expect(webhookPost.status).toBe(200);
    expect(webhookGet.status).toBe(401);
    expect(callbackGet.status).toBe(200);
    expect(localizedWebhook.status).toBe(403);
  });

  it("accepts a valid signed preview cookie and marks UI responses private", async () => {
    configureClosedProduction();
    const token = await issueAccessGateCookie(SIGNING_SECRET);
    const response = await proxy(
      new NextRequest("https://www.lyvox.be/en/search", {
        headers: { cookie: `__Host-lyvox-preview=${token}` },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("vary")).toContain("Cookie");
  });

  it("keeps Vercel previews closed even when they inherit the public GO flag", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("PRODUCTION_ACCESS_GATE_ENABLED", "false");
    vi.stubEnv("PRODUCTION_ACCESS_CODE", ACCESS_CODE);
    vi.stubEnv("PRODUCTION_ACCESS_GATE_SECRET", SIGNING_SECRET);
    vi.stubEnv("TURNSTILE_SECRET_KEY", "turnstile-secret");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "turnstile-site-key");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const previewUi = await proxy(
      new NextRequest("https://preview.lyvox.be/en/search"),
    );
    const previewApi = await proxy(
      new NextRequest("https://preview.lyvox.be/api/search"),
    );

    expect(previewUi.status).toBe(307);
    expect(previewApi.status).toBe(503);
  });

  it("does not gate an explicit public GO production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PRODUCTION_ACCESS_GATE_ENABLED", "false");
    const publicResponse = await proxy(
      new NextRequest("https://www.lyvox.be/en/search"),
    );

    expect(publicResponse.status).toBe(200);
  });

  it("uses a matcher without an extension-based API escape hatch", () => {
    expect(config.matcher).toEqual(["/((?!_next/static|_next/image).*)"]);
  });

  it.each([
    ["/api/search", true],
    ["/private.json", true],
    ["/private%2Ejson", true],
    ["/favicon.ico", true],
    ["/favicon.ico/anything", true],
    ["/_next/static/chunks/app.js", false],
    ["/_next/image?url=%2Flogo.png&w=128&q=75", false],
  ])("matches the actual Next request boundary for %s", (url, expected) => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url,
      }),
    ).toBe(expected);
  });
});
