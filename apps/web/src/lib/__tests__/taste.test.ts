import { describe, it, expect, beforeEach } from "vitest";
import { recordSignal, scoreCard, resetTaste, getTasteWeights, type TasteCard } from "../taste";
import { writeConsent } from "@/lib/cookieConsent/store";

const KEY = "lyvox:taste";

const card = (over: Partial<TasteCard> = {}): TasteCard => ({
  categoryId: "cat1",
  sellerId: "seller1",
  location: "Brussels",
  price: 120, // band floor(120/50)=2
  ...over,
});

function clearConsentCookie() {
  document.cookie = "lyvox_cookie_consent=; path=/; max-age=0";
}

describe("taste — consent gate (no consent)", () => {
  beforeEach(() => {
    clearConsentCookie();
    resetTaste();
  });

  it("write path: recordSignal does NOT persist weights to localStorage without functional consent", () => {
    recordSignal(card(), "like");
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("read path: getTasteWeights returns {} without functional consent", () => {
    // Seed stale data
    window.localStorage.setItem(KEY, JSON.stringify({ "cat:cat1": 5 }));
    expect(getTasteWeights()).toEqual({});
  });

  it("read path: scoreCard returns 0 without functional consent (ignores stale data)", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ "cat:cat1": 10 }));
    expect(scoreCard(card())).toBe(0);
  });
});

describe("taste — with functional consent granted", () => {
  beforeEach(() => {
    clearConsentCookie();
    writeConsent({ functional: true, analytics: false });
    resetTaste();
  });

  it("cold start scores every card 0", () => {
    expect(scoreCard(card())).toBe(0);
    expect(getTasteWeights()).toEqual({});
  });

  it("a like raises the card's own score by its dimension count (4)", () => {
    const c = card();
    recordSignal(c, "like");
    expect(scoreCard(c)).toBe(4); // cat + seller + loc + price-band, each +1
  });

  it("favorite double-weights, pass is negative", () => {
    const c = card({ categoryId: "catF", sellerId: null, location: null, price: null });
    recordSignal(c, "favorite");
    expect(scoreCard(c)).toBe(2); // only category dim, +2
    recordSignal(c, "pass");
    expect(scoreCard(c)).toBe(1); // +2 then -1
  });

  it("credits partial overlap across cards (shared category)", () => {
    recordSignal(card({ sellerId: "sX", location: "Ghent", price: 999 }), "like"); // bumps cat1 +1 (and others)
    const sameCategoryDifferentElse = card({ sellerId: "sY", location: "Liege", price: 5 });
    // shares only cat1 with the liked card → score 1
    expect(scoreCard(sameCategoryDifferentElse)).toBe(1);
  });

  it("reset clears all weights", () => {
    recordSignal(card(), "like");
    resetTaste();
    expect(getTasteWeights()).toEqual({});
    expect(scoreCard(card())).toBe(0);
  });

  it("ignores null dimensions without throwing", () => {
    const bare: TasteCard = { categoryId: null, sellerId: null, location: null, price: null };
    recordSignal(bare, "like");
    expect(scoreCard(bare)).toBe(0);
    expect(getTasteWeights()).toEqual({});
  });
});
