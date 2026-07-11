import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  supabaseService: vi.fn(),
}));

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: mocks.supabaseService,
}));

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

afterEach(() => {
  vi.unstubAllEnvs();
  mocks.supabaseService.mockReset();
});

describe("closed production indexing", () => {
  it("disallows every crawler and does not advertise a sitemap", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PRODUCTION_ACCESS_GATE_ENABLED", "true");

    const result = robots();

    expect(result.rules).toEqual({ userAgent: "*", disallow: "/" });
    expect(result).not.toHaveProperty("sitemap");
  });

  it("returns an empty sitemap without touching service-role data", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PRODUCTION_ACCESS_GATE_ENABLED", "true");

    await expect(sitemap()).resolves.toEqual([]);
    expect(mocks.supabaseService).not.toHaveBeenCalled();
  });
});
