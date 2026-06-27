import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { GATED_KEYS } from "@/lib/cookieConsent/inventory";

// ── helpers ──────────────────────────────────────────────────────────────────

/** Build a valid cookie string for `lyvox_cookie_consent`. */
function buildCookieValue(
  prefs: { functional: boolean; analytics: boolean },
  ts: number,
): string {
  return JSON.stringify({ v: 1, ...prefs, ts });
}

/** Stamp document.cookie with a given lyvox_cookie_consent value. */
function setCookieRaw(value: string): void {
  Object.defineProperty(document, "cookie", {
    writable: true,
    configurable: true,
    value: `lyvox_cookie_consent=${encodeURIComponent(value)}`,
  });
}

/** Clear the consent cookie (simulate absent cookie). */
function clearCookie(): void {
  Object.defineProperty(document, "cookie", {
    writable: true,
    configurable: true,
    value: "",
  });
}

// ── import after helpers so we can set up env ─────────────────────────────────
// Dynamic import used here so we import the module inside jsdom with window available.
// We use a top-level import instead and rely on jsdom being present.

import {
  readConsent,
  isStale,
  hasConsent,
  writeConsent,
} from "@/lib/cookieConsent/store";

// ── tests ────────────────────────────────────────────────────────────────────

describe("store — readConsent", () => {
  beforeEach(() => clearCookie());

  it("returns null when cookie is absent (undecided)", () => {
    expect(readConsent()).toBeNull();
  });

  it("returns null when cookie JSON is malformed", () => {
    setCookieRaw("not-json");
    expect(readConsent()).toBeNull();
  });

  it("returns null when cookie is missing required fields", () => {
    setCookieRaw(JSON.stringify({ v: 1 }));
    expect(readConsent()).toBeNull();
  });

  it("parses a valid cookie correctly", () => {
    const ts = Date.now();
    setCookieRaw(buildCookieValue({ functional: true, analytics: false }, ts));
    const consent = readConsent();
    expect(consent).not.toBeNull();
    expect(consent!.functional).toBe(true);
    expect(consent!.analytics).toBe(false);
    expect(consent!.ts).toBe(ts);
  });
});

describe("store — isStale", () => {
  it("returns false for a fresh consent", () => {
    const now = Date.now();
    const c = { functional: true, analytics: false, ts: now - 1000 };
    expect(isStale(c, now)).toBe(false);
  });

  it("returns true when consent is older than 365 days", () => {
    const now = Date.now();
    const staleTs = now - 365 * 24 * 3600 * 1000 - 1;
    const c = { functional: true, analytics: false, ts: staleTs };
    expect(isStale(c, now)).toBe(true);
  });

  it("uses Date.now() when now is omitted", () => {
    const staleTs = Date.now() - 366 * 24 * 3600 * 1000;
    const c = { functional: true, analytics: false, ts: staleTs };
    expect(isStale(c)).toBe(true);
  });
});

describe("store — hasConsent (deny-by-default)", () => {
  beforeEach(() => clearCookie());

  it("always returns true for necessary category regardless of consent", () => {
    expect(hasConsent("necessary")).toBe(true);
  });

  it("returns false for functional when cookie is absent (undecided)", () => {
    expect(hasConsent("functional")).toBe(false);
  });

  it("returns false for analytics when cookie is absent (undecided)", () => {
    expect(hasConsent("analytics")).toBe(false);
  });

  it("returns false for functional when cookie is stale", () => {
    const staleTs = Date.now() - 366 * 24 * 3600 * 1000;
    setCookieRaw(buildCookieValue({ functional: true, analytics: true }, staleTs));
    expect(hasConsent("functional")).toBe(false);
  });

  it("returns false for analytics when cookie is stale", () => {
    const staleTs = Date.now() - 366 * 24 * 3600 * 1000;
    setCookieRaw(buildCookieValue({ functional: true, analytics: true }, staleTs));
    expect(hasConsent("analytics")).toBe(false);
  });

  it("returns true for functional after explicit grant", () => {
    const ts = Date.now();
    setCookieRaw(buildCookieValue({ functional: true, analytics: false }, ts));
    expect(hasConsent("functional")).toBe(true);
  });

  it("returns false for analytics when only functional is granted", () => {
    const ts = Date.now();
    setCookieRaw(buildCookieValue({ functional: true, analytics: false }, ts));
    expect(hasConsent("analytics")).toBe(false);
  });

  it("uses passed consent object instead of reading the cookie", () => {
    // Cookie says functional=false but we pass c with functional=true
    const ts = Date.now();
    setCookieRaw(buildCookieValue({ functional: false, analytics: false }, ts));
    const c = { functional: true, analytics: false, ts };
    expect(hasConsent("functional", c)).toBe(true);
  });

  it("returns false when passed consent is null (deny-by-default)", () => {
    expect(hasConsent("functional", null)).toBe(false);
  });
});

describe("store — writeConsent then readConsent", () => {
  beforeEach(() => {
    clearCookie();
    // Reset cookie jar: jsdom writes to document.cookie normally via its own setter
    // We need to reset so writeConsent can set it.
    Object.defineProperty(document, "cookie", {
      writable: true,
      configurable: true,
      // Restore jsdom default getter/setter behavior by making it a data prop
      // We'll use a simple string store for test purposes.
      value: "",
    });
  });

  afterEach(() => {
    clearCookie();
  });

  it("writeConsent({functional:true}) then readConsent returns the stored prefs", () => {
    const now = Date.now();
    // We intercept document.cookie writes for jsdom
    let cookieJar = "";
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get() {
        return cookieJar;
      },
      set(val: string) {
        // parse key=value from the Set-Cookie style string
        const eqIdx = val.indexOf("=");
        if (eqIdx === -1) return;
        const name = val.slice(0, eqIdx).trim();
        const valueAndAttrs = val.slice(eqIdx + 1);
        const [rawValue] = valueAndAttrs.split(";");
        // Replace or add cookie
        const existing = cookieJar
          .split("; ")
          .filter((c) => c.split("=")[0].trim() !== name);
        existing.push(`${name}=${rawValue.trim()}`);
        cookieJar = existing.filter(Boolean).join("; ");
      },
    });

    writeConsent({ functional: true, analytics: false }, now);
    const consent = readConsent();
    expect(consent).not.toBeNull();
    expect(consent!.functional).toBe(true);
    expect(consent!.analytics).toBe(false);
    expect(consent!.ts).toBe(now);
  });

  it("hasConsent(functional) is true after writeConsent({functional:true})", () => {
    const now = Date.now();
    let cookieJar = "";
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get() { return cookieJar; },
      set(val: string) {
        const eqIdx = val.indexOf("=");
        if (eqIdx === -1) return;
        const name = val.slice(0, eqIdx).trim();
        const valueAndAttrs = val.slice(eqIdx + 1);
        const [rawValue] = valueAndAttrs.split(";");
        const existing = cookieJar.split("; ").filter((c) => c.split("=")[0].trim() !== name);
        existing.push(`${name}=${rawValue.trim()}`);
        cookieJar = existing.filter(Boolean).join("; ");
      },
    });

    writeConsent({ functional: true, analytics: false }, now);
    expect(hasConsent("necessary")).toBe(true);
    expect(hasConsent("functional")).toBe(true);
  });
});

describe("store — writeConsent purges gated storage and dispatches event", () => {
  beforeEach(() => {
    clearCookie();
    // Use a simple in-memory localStorage via jsdom (already available)
    // Seed some gated keys
    for (const k of GATED_KEYS) {
      localStorage.setItem(k, "test-data");
    }
  });

  afterEach(() => {
    localStorage.clear();
    clearCookie();
    vi.restoreAllMocks();
  });

  it("writeConsent({functional:false}) removes all functional GATED_KEYS from localStorage", () => {
    // Verify all GATED_KEYS were pre-seeded (beforeEach)
    for (const k of GATED_KEYS) {
      expect(localStorage.getItem(k)).toBe("test-data");
    }

    // Set up cookie jar
    let cookieJar = "";
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get() { return cookieJar; },
      set(val: string) {
        const eqIdx = val.indexOf("=");
        if (eqIdx === -1) return;
        const name = val.slice(0, eqIdx).trim();
        const valueAndAttrs = val.slice(eqIdx + 1);
        const [rawValue] = valueAndAttrs.split(";");
        const existing = cookieJar.split("; ").filter((c) => c.split("=")[0].trim() !== name);
        existing.push(`${name}=${rawValue.trim()}`);
        cookieJar = existing.filter(Boolean).join("; ");
      },
    });

    writeConsent({ functional: false, analytics: false });

    // All gated keys must have been removed
    for (const k of GATED_KEYS) {
      expect(localStorage.getItem(k)).toBeNull();
    }
  });

  it("writeConsent({functional:false}) dispatches lyvox:cookie-consent-changed event", () => {
    const events: Event[] = [];
    window.addEventListener("lyvox:cookie-consent-changed", (e) => events.push(e));

    let cookieJar = "";
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get() { return cookieJar; },
      set(val: string) {
        const eqIdx = val.indexOf("=");
        if (eqIdx === -1) return;
        const name = val.slice(0, eqIdx).trim();
        const valueAndAttrs = val.slice(eqIdx + 1);
        const [rawValue] = valueAndAttrs.split(";");
        const existing = cookieJar.split("; ").filter((c) => c.split("=")[0].trim() !== name);
        existing.push(`${name}=${rawValue.trim()}`);
        cookieJar = existing.filter(Boolean).join("; ");
      },
    });

    writeConsent({ functional: false, analytics: false });

    expect(events.length).toBe(1);
    expect(events[0].type).toBe("lyvox:cookie-consent-changed");

    window.removeEventListener("lyvox:cookie-consent-changed", (e) => events.push(e));
  });

  it("writeConsent({functional:true}) does NOT remove functional GATED_KEYS from localStorage", () => {
    // Verify all GATED_KEYS were pre-seeded (beforeEach)
    for (const k of GATED_KEYS) {
      expect(localStorage.getItem(k)).toBe("test-data");
    }

    let cookieJar = "";
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get() { return cookieJar; },
      set(val: string) {
        const eqIdx = val.indexOf("=");
        if (eqIdx === -1) return;
        const name = val.slice(0, eqIdx).trim();
        const valueAndAttrs = val.slice(eqIdx + 1);
        const [rawValue] = valueAndAttrs.split(";");
        const existing = cookieJar.split("; ").filter((c) => c.split("=")[0].trim() !== name);
        existing.push(`${name}=${rawValue.trim()}`);
        cookieJar = existing.filter(Boolean).join("; ");
      },
    });

    writeConsent({ functional: true, analytics: false });

    // All gated keys must still be present
    for (const k of GATED_KEYS) {
      expect(localStorage.getItem(k)).toBe("test-data");
    }
  });
});
