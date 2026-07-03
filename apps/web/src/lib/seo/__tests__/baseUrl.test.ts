import { afterEach, describe, expect, it, vi } from "vitest";
import { absoluteUrl, getBaseUrl } from "@/lib/seo/baseUrl";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getBaseUrl", () => {
  it("strips a trailing slash from NEXT_PUBLIC_SITE_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.lyvox.be/");
    expect(getBaseUrl()).toBe("https://www.lyvox.be");
  });

  it("strips multiple trailing slashes", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.lyvox.be///");
    expect(getBaseUrl()).toBe("https://www.lyvox.be");
  });

  it("falls back to NEXT_PUBLIC_BASE_URL when SITE_URL is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://staging.lyvox.be/");
    expect(getBaseUrl()).toBe("https://staging.lyvox.be");
  });

  it("defaults to https://www.lyvox.be when no env is set", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");
    expect(getBaseUrl()).toBe("https://www.lyvox.be");
  });
});

describe("absoluteUrl", () => {
  it("joins a leading-slash path onto the base with exactly one slash", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.lyvox.be/");
    expect(absoluteUrl("/ad/123/some-slug")).toBe("https://www.lyvox.be/ad/123/some-slug");
  });

  it("joins a path without a leading slash", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.lyvox.be");
    expect(absoluteUrl("ad/123/some-slug")).toBe("https://www.lyvox.be/ad/123/some-slug");
  });

  it("never produces a double slash even with a messy env value", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.lyvox.be//");
    expect(absoluteUrl("/ad/123")).not.toContain("//ad");
    expect(absoluteUrl("/ad/123")).toBe("https://www.lyvox.be/ad/123");
  });
});
