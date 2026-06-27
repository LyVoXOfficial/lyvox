"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  readConsent,
  isStale,
  writeConsent,
  type CookieConsent,
} from "@/lib/cookieConsent/store";

// ── Context shape ──────────────────────────────────────────────────────────

interface CookieConsentContextValue {
  /** The currently stored consent record; null = undecided / SSR-initial. */
  consent: CookieConsent | null;
  /**
   * true when a valid, non-stale consent cookie exists.
   * false while undecided, stale, or during SSR.
   */
  decided: boolean;
  /** Opens the preference center modal. */
  openPreferences: () => void;
  /** Closes the preference center modal. */
  closePreferences: () => void;
  /** Whether the preference center is currently open. */
  preferencesOpen: boolean;
  /** Persist a new consent choice and refresh provider state. */
  save: (prefs: { functional: boolean; analytics: boolean }) => void;
}

const CookieConsentCtx = createContext<CookieConsentContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  // Initial state is null/false — SSR-safe (no document access in module scope).
  const [consent, setConsent] = useState<CookieConsent | null>(null);
  const [mounted, setMounted] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  /** Re-read the cookie and refresh local state. */
  const syncConsent = useCallback(() => {
    const c = readConsent();
    setConsent(c);
  }, []);

  useEffect(() => {
    // First read — safe in useEffect (client-only).
    syncConsent();
    setMounted(true);

    // Subscribe to programmatic writes from this tab.
    window.addEventListener("lyvox:cookie-consent-changed", syncConsent);
    // Subscribe to cross-tab cookie changes via storage event (best-effort).
    window.addEventListener("storage", syncConsent);

    return () => {
      window.removeEventListener("lyvox:cookie-consent-changed", syncConsent);
      window.removeEventListener("storage", syncConsent);
    };
  }, [syncConsent]);

  const save = useCallback(
    (prefs: { functional: boolean; analytics: boolean }) => {
      writeConsent(prefs); // also dispatches lyvox:cookie-consent-changed
      // Optimistically update state so banner hides immediately (the event
      // listener will also fire, but this avoids a render gap).
      const fresh = readConsent();
      setConsent(fresh);
    },
    []
  );

  const openPreferences = useCallback(() => setPreferencesOpen(true), []);
  const closePreferences = useCallback(() => setPreferencesOpen(false), []);

  // decided = mounted AND consent exists AND not stale
  const decided =
    mounted && consent !== null && !isStale(consent);

  const value: CookieConsentContextValue = {
    consent,
    decided,
    openPreferences,
    closePreferences,
    preferencesOpen,
    save,
  };

  return (
    <CookieConsentCtx.Provider value={value}>
      {children}
    </CookieConsentCtx.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useCookieConsent(): CookieConsentContextValue {
  const ctx = useContext(CookieConsentCtx);
  if (!ctx) {
    throw new Error(
      "useCookieConsent must be used within <CookieConsentProvider>"
    );
  }
  return ctx;
}
