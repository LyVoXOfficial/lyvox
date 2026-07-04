import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  buildAdvertSourceHash,
  getAdvertTargetLocales,
  markAdvertTranslationsStale,
  resolveAdvertSourceLocale,
} = await import("../advertTranslations");

describe("advert translation helpers", () => {
  it("builds a stable sha256 source hash from title plus description", () => {
    expect(buildAdvertSourceHash({ title: "Bike", description: "Blue" })).toBe(
      "82ab5710ab1bb8863c05c7a2460781c9397af804fdf8ef16371dd07b3cdde1aa",
    );
  });

  it("normalises source locale and returns all non-source target locales", () => {
    expect(resolveAdvertSourceLocale("nl-BE")).toBe("nl");
    expect(getAdvertTargetLocales("nl-BE")).toEqual(["en", "fr", "ru", "de"]);
  });

  it("marks existing advert translations stale with a single update", async () => {
    const neqMock = vi.fn().mockResolvedValue({ error: null });
    const eqMock = vi.fn(() => ({ neq: neqMock }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({ update: updateMock }));

    await expect(
      markAdvertTranslationsStale({ from: fromMock } as never, "advert-1"),
    ).resolves.toBeNull();

    expect(fromMock).toHaveBeenCalledWith("advert_translations");
    expect(updateMock).toHaveBeenCalledWith({ status: "stale" });
    expect(eqMock).toHaveBeenCalledWith("advert_id", "advert-1");
    expect(neqMock).toHaveBeenCalledWith("status", "stale");
  });
});
