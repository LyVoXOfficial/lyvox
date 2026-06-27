import { describe, it, expect, beforeEach } from "vitest";
import { getSeenAdverts, addSeenAdverts, isSeen, clearSeenAdverts } from "../seenAdverts";
import { writeConsent } from "@/lib/cookieConsent/store";

const KEY = "lyvox:seenAdverts";

function clearConsentCookie() {
  document.cookie = "lyvox_cookie_consent=; path=/; max-age=0";
}

describe("seenAdverts — consent gate (no consent)", () => {
  beforeEach(() => {
    clearConsentCookie();
    clearSeenAdverts();
  });

  it("write path: addSeenAdverts does NOT persist to localStorage without functional consent", () => {
    addSeenAdverts(["a", "b"]);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("read path: getSeenAdverts returns empty Set without functional consent", () => {
    // Seed stale data
    window.localStorage.setItem(KEY, JSON.stringify(["stale1", "stale2"]));
    expect(getSeenAdverts().size).toBe(0);
  });

  it("read path: isSeen returns false without functional consent (even if stale data exists)", () => {
    window.localStorage.setItem(KEY, JSON.stringify(["seen-id"]));
    expect(isSeen("seen-id")).toBe(false);
  });
});

describe("seenAdverts — with functional consent granted", () => {
  beforeEach(() => {
    clearConsentCookie();
    writeConsent({ functional: true, analytics: false });
    clearSeenAdverts();
  });

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
