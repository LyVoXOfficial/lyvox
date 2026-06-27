// Pure, SSR-safe, framework-free cookie consent state machine.
// No React. No server-side I/O. All document/window/localStorage access guarded.

import { type ConsentCategory, GATED_KEYS } from "./inventory";

export type CookieConsent = {
  functional: boolean;
  analytics: boolean;
  ts: number;
};

const COOKIE_NAME = "lyvox_cookie_consent";
const MAX_AGE_SECONDS = 365 * 24 * 3600; // 1 year
const STALE_MS = 365 * 24 * 3600 * 1000; // 365 days in milliseconds

// ── Internal helpers ──────────────────────────────────────────────────────────

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function getCookieValue(name: string): string | null {
  if (!isBrowser()) return null;
  const cookies = document.cookie.split("; ");
  for (const raw of cookies) {
    const eqIdx = raw.indexOf("=");
    if (eqIdx === -1) continue;
    const key = raw.slice(0, eqIdx).trim();
    if (key === name) {
      try {
        return decodeURIComponent(raw.slice(eqIdx + 1));
      } catch {
        return raw.slice(eqIdx + 1);
      }
    }
  }
  return null;
}

function isValidConsent(obj: unknown): obj is CookieConsent {
  if (!obj || typeof obj !== "object") return false;
  const c = obj as Record<string, unknown>;
  return (
    typeof c.functional === "boolean" &&
    typeof c.analytics === "boolean" &&
    typeof c.ts === "number"
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Read and parse the `lyvox_cookie_consent` cookie.
 * Returns `null` when absent, malformed, or running in SSR context.
 * `null` means undecided — banner should be shown, all non-essential treated as OFF.
 */
export function readConsent(): CookieConsent | null {
  const raw = getCookieValue(COOKIE_NAME);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValidConsent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Returns true if the consent record is older than 365 days (re-prompt needed).
 * Accepts an optional `now` override for testability.
 */
export function isStale(c: CookieConsent, now?: number): boolean {
  return (now ?? Date.now()) - c.ts > STALE_MS;
}

/**
 * Deny-by-default consent check.
 * - `necessary` → always true (no consent needed).
 * - `functional` / `analytics` → false when undecided (null) OR stale; otherwise
 *   the stored boolean for that category.
 * Pass `c` to avoid a redundant cookie read when the caller already has it.
 */
export function hasConsent(
  category: ConsentCategory,
  c?: CookieConsent | null,
): boolean {
  if (category === "necessary") return true;

  const consent = c !== undefined ? c : readConsent();
  if (!consent) return false;
  if (isStale(consent)) return false;

  if (category === "functional") return consent.functional;
  if (category === "analytics") return consent.analytics;

  // Unknown category — deny by default
  return false;
}

/**
 * Persist consent preferences.
 * - Writes the cookie (`lyvox_cookie_consent`, 1 year, SameSite=Lax, Secure in prod, path=/).
 * - Purges any gated `localStorage` keys for categories now set to `false`.
 * - Dispatches `window` event `lyvox:cookie-consent-changed` so subscribers re-read.
 *
 * All side-effects are guarded against SSR.
 * Accepts an optional `now` override for testability.
 */
export function writeConsent(
  prefs: { functional: boolean; analytics: boolean },
  now?: number,
): void {
  if (!isBrowser()) return;

  const ts = now ?? Date.now();
  const payload = JSON.stringify({ v: 1, functional: prefs.functional, analytics: prefs.analytics, ts });

  const secure =
    typeof location !== "undefined" && location.protocol === "https:"
      ? "; Secure"
      : "";

  document.cookie =
    `${COOKIE_NAME}=${encodeURIComponent(payload)}` +
    `; path=/` +
    `; max-age=${MAX_AGE_SECONDS}` +
    `; SameSite=Lax` +
    secure;

  // Purge gated localStorage keys for any category now OFF.
  if (!prefs.functional) {
    for (const key of GATED_KEYS) {
      try {
        // Use the global `localStorage` (same reference the spy wraps in tests).
        // eslint-disable-next-line no-restricted-globals
        localStorage.removeItem(key);
      } catch {
        // Private mode / quota — degrade silently
      }
    }
  }
  // analytics keys: reserved for future libs; GATED_KEYS currently only functional.
  // When analytics keys are added to the inventory, add a similar block here.

  // Notify subscribers.
  window.dispatchEvent(new Event("lyvox:cookie-consent-changed"));
}
