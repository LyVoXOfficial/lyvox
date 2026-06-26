import { describe, it, expect, beforeEach } from "vitest";
import { getSeenAdverts, addSeenAdverts, isSeen, clearSeenAdverts } from "../seenAdverts";

describe("seenAdverts", () => {
  beforeEach(() => clearSeenAdverts());

  it("records and reports seen ids", () => {
    addSeenAdverts(["a", "b", "c"]);
    expect(isSeen("a")).toBe(true);
    expect(isSeen("z")).toBe(false);
    expect(getSeenAdverts()).toEqual(new Set(["a", "b", "c"]));
  });

  it("dedupes across calls", () => {
    addSeenAdverts(["a"]);
    addSeenAdverts(["a", "b"]);
    expect([...getSeenAdverts()].sort()).toEqual(["a", "b"]);
  });

  it("FIFO-caps at 500 (oldest evicted, newest kept)", () => {
    const ids = Array.from({ length: 520 }, (_, i) => `id${i}`);
    addSeenAdverts(ids);
    const seen = getSeenAdverts();
    expect(seen.size).toBe(500);
    expect(seen.has("id0")).toBe(false);
    expect(seen.has("id19")).toBe(false);
    expect(seen.has("id20")).toBe(true);
    expect(seen.has("id519")).toBe(true);
  });

  it("clear empties the store", () => {
    addSeenAdverts(["a"]);
    clearSeenAdverts();
    expect(getSeenAdverts().size).toBe(0);
  });

  it("ignores empty input", () => {
    addSeenAdverts([]);
    expect(getSeenAdverts().size).toBe(0);
  });
});
