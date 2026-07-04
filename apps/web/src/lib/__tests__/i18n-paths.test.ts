import { afterEach, describe, expect, it, vi } from "vitest";
import { localizeHref, localizePath, stripLocalePrefix } from "@/lib/i18n";
import { languageAlternates } from "@/lib/seo/localizedUrls";

describe("locale path helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("adds and replaces locale prefixes while preserving query and hash", () => {
    expect(localizePath("/c/transport?page=2#top", "nl")).toBe("/nl/c/transport?page=2#top");
    expect(localizePath("/fr/ad/123?published=1", "de")).toBe("/de/ad/123?published=1");
    expect(localizePath("/", "ru")).toBe("/ru");
  });

  it("strips a locale prefix without changing legacy paths", () => {
    expect(stripLocalePrefix("/nl/c/transport")).toEqual({
      locale: "nl",
      pathname: "/c/transport",
    });
    expect(stripLocalePrefix("/c/transport")).toEqual({
      locale: null,
      pathname: "/c/transport",
    });
  });

  it("does not localize api, external, or hash-only hrefs", () => {
    expect(localizeHref("/api/search", "fr")).toBe("/api/search");
    expect(localizeHref("https://example.com/c", "fr")).toBe("https://example.com/c");
    expect(localizeHref("#details", "fr")).toBe("#details");
  });

  it("builds five language alternates plus x-default", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.lyvox.be");

    expect(languageAlternates("/sell")).toEqual({
      en: "https://www.lyvox.be/en/sell",
      fr: "https://www.lyvox.be/fr/sell",
      nl: "https://www.lyvox.be/nl/sell",
      ru: "https://www.lyvox.be/ru/sell",
      de: "https://www.lyvox.be/de/sell",
      "x-default": "https://www.lyvox.be/sell",
    });
  });
});
