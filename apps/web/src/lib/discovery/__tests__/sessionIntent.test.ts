import { beforeEach, describe, expect, it } from "vitest";
import { writeConsent } from "@/lib/cookieConsent/store";
import type { AdvertCard } from "@/lib/advertCards";
import {
  getSessionIntent,
  rankSessionItems,
  recordAdOpen,
  recordCategoryClick,
  reset,
  toPriceBand,
  type SessionIntentState,
} from "../sessionIntent";

const KEY = "lyvox:sessionIntent";

const card = (id: string, over: Partial<AdvertCard> = {}): AdvertCard => ({
  id,
  categoryId: null,
  title: id,
  price: null,
  currency: null,
  location: null,
  image: null,
  createdAt: null,
  sellerVerified: false,
  likeCount: 0,
  ...over,
});

function clearConsentCookie() {
  document.cookie = "lyvox_cookie_consent=; path=/; max-age=0";
}

describe("sessionIntent - consent gate", () => {
  beforeEach(() => {
    clearConsentCookie();
    window.sessionStorage.clear();
  });

  it("does not persist session intent without functional consent", () => {
    recordCategoryClick("cat-a");
    recordAdOpen("cat-a", "100_250");
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
    expect(getSessionIntent().mode).toBe("off");
  });

  it("persists only to sessionStorage when functional consent is granted", () => {
    writeConsent({ functional: true, analytics: false });
    recordCategoryClick("cat-a");
    recordAdOpen("cat-a", toPriceBand(125));

    expect(window.localStorage.getItem(KEY)).toBeNull();
    const intent = getSessionIntent();
    expect(intent.mode).toBe("session_only");
    expect(intent.source).toBe("sessionStorage");
    expect(intent.categories["cat-a"]).toBe(3);
    expect(intent.priceBands["100_250"]).toBe(1);
  });

  it("reset clears stored signals", () => {
    writeConsent({ functional: true, analytics: false });
    recordAdOpen("cat-a", "100_250");
    reset();

    expect(window.sessionStorage.getItem(KEY)).toBeNull();
    expect(getSessionIntent().categories).toEqual({});
    expect(getSessionIntent().priceBands).toEqual({});
  });
});

describe("rankSessionItems", () => {
  const offIntent: SessionIntentState = {
    mode: "off",
    source: "memory",
    updatedAt: 0,
    categories: { "cat-b": 9 },
    priceBands: { "100_250": 9 },
    localRadiusKm: null,
  };

  const sessionIntent: SessionIntentState = {
    ...offIntent,
    mode: "session_only",
  };

  it("returns the original array when mode is off", () => {
    const items = [card("a"), card("b", { categoryId: "cat-b", price: 125 })];
    expect(rankSessionItems(items, offIntent)).toBe(items);
  });

  it("reranks without hiding items", () => {
    const out = rankSessionItems(
      [
        card("a", { categoryId: "cat-a", price: 20 }),
        card("b", { categoryId: "cat-b", price: 125 }),
        card("c", { categoryId: "cat-c", price: 900 }),
      ],
      sessionIntent,
    );

    expect(out.map((c) => c.id)).toEqual(["b", "a", "c"]);
    expect(out).toHaveLength(3);
  });

  it("keeps source order for ties", () => {
    const out = rankSessionItems(
      [
        card("a", { categoryId: "cat-a", price: 20 }),
        card("b", { categoryId: "cat-a", price: 25 }),
        card("c", { categoryId: "cat-c", price: 25 }),
      ],
      {
        ...sessionIntent,
        categories: { "cat-a": 1 },
        priceBands: {},
      },
    );

    expect(out.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });
});
