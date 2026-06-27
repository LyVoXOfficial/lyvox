/**
 * CookieBanner + CookiePreferenceCenter + CookieConsentProvider RTL tests.
 *
 * TDD: tests written before implementation.
 * RTL/jsdom, vitest globals (describe/it/expect/vi/beforeEach).
 *
 * Note: CookieBanner renders null until mounted AND !decided, so we use
 * `findBy*` (async) for "fresh visitor → banner visible" assertions.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CookieConsentProvider } from "../CookieConsentProvider";
import { CookieBanner } from "../CookieBanner";
import { CookiePreferenceCenter } from "../CookiePreferenceCenter";
import { readConsent, writeConsent } from "@/lib/cookieConsent/store";

// ── i18n minimal stub ──────────────────────────────────────────────────────
vi.mock("@/i18n", () => ({
  useI18n: () => ({
    locale: "en",
    t: (k: string) => k, // returns key so tr() falls through to fallback
  }),
}));

// ── Cookie helpers ──────────────────────────────────────────────────────────
function clearConsentCookie() {
  document.cookie =
    "lyvox_cookie_consent=; path=/; max-age=0; SameSite=Lax";
}

// Minimal wrapper: provider + both UI pieces
function AppWithConsent() {
  return (
    <CookieConsentProvider>
      <CookieBanner />
      <CookiePreferenceCenter />
    </CookieConsentProvider>
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("CookieBanner — fresh visitor (no cookie)", () => {
  beforeEach(() => {
    clearConsentCookie();
  });

  it("renders the banner after mount (async, because effect reads cookie)", async () => {
    render(<AppWithConsent />);
    // Banner is null during SSR/first render; appears after useEffect
    const rejectBtn = await screen.findByRole("button", { name: /reject all/i });
    expect(rejectBtn).toBeTruthy();
  });

  it("renders both 'Reject all' and 'Accept all' with EQUAL visual prominence (same variant class)", async () => {
    render(<AppWithConsent />);
    const rejectBtn = await screen.findByRole("button", { name: /reject all/i });
    const acceptBtn = await screen.findByRole("button", { name: /accept all/i });

    // Both buttons must be rendered
    expect(rejectBtn).toBeTruthy();
    expect(acceptBtn).toBeTruthy();

    // Equal prominence: both must have data-variant="secondary" (or neither should
    // have it; what matters is they share the same data-variant attribute value).
    // We enforce this by checking data-variant attribute — the implementation MUST
    // set data-variant={variant} on both buttons so this assertion is machine-checkable.
    expect(rejectBtn.getAttribute("data-variant")).toBe(
      acceptBtn.getAttribute("data-variant")
    );

    // Neither should be a ghost/outline (muted) while the other is default/primary
    const rejectClass = rejectBtn.className;
    const acceptClass = acceptBtn.className;
    expect(rejectClass).toBe(acceptClass);
  });

  it("clicking 'Reject all' hides the banner and writes consent functional=false", async () => {
    render(<AppWithConsent />);
    const rejectBtn = await screen.findByRole("button", { name: /reject all/i });
    fireEvent.click(rejectBtn);

    // Banner should vanish
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /reject all/i })
      ).toBeNull();
    });

    // Cookie written with functional=false
    const consent = readConsent();
    expect(consent).not.toBeNull();
    expect(consent!.functional).toBe(false);
    expect(consent!.analytics).toBe(false);
  });

  it("clicking 'Accept all' hides the banner and writes consent functional=true", async () => {
    render(<AppWithConsent />);
    const acceptBtn = await screen.findByRole("button", { name: /accept all/i });
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /accept all/i })
      ).toBeNull();
    });

    const consent = readConsent();
    expect(consent).not.toBeNull();
    expect(consent!.functional).toBe(true);
    expect(consent!.analytics).toBe(true);
  });
});

describe("CookieBanner — returning visitor (valid cookie)", () => {
  beforeEach(() => {
    clearConsentCookie();
    writeConsent({ functional: true, analytics: false });
  });

  it("does NOT render the banner when a valid consent cookie exists", async () => {
    render(<AppWithConsent />);
    // Give effects time to run, then assert still absent
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /reject all/i })
      ).toBeNull();
    });
  });
});

describe("CookiePreferenceCenter — fresh visitor toggle defaults", () => {
  beforeEach(() => {
    clearConsentCookie();
  });

  it("functional and analytics switches are OFF by default (unchecked)", async () => {
    render(<AppWithConsent />);

    // Open the preference center via Customize button
    const customizeBtn = await screen.findByRole("button", { name: /customize/i });
    fireEvent.click(customizeBtn);

    // Functional switch must be role="switch" and aria-checked="false"
    await waitFor(() => {
      const functionalSwitch = screen.getByRole("switch", { name: /functional/i });
      expect(functionalSwitch).toHaveAttribute("aria-checked", "false");
    });

    const analyticsSwitch = screen.getByRole("switch", { name: /analytics/i });
    expect(analyticsSwitch).toHaveAttribute("aria-checked", "false");
  });

  it("Necessary switch is always-on (disabled)", async () => {
    render(<AppWithConsent />);
    const customizeBtn = await screen.findByRole("button", { name: /customize/i });
    fireEvent.click(customizeBtn);

    await waitFor(() => {
      const necessarySwitch = screen.getByRole("switch", { name: /necessary/i });
      expect(necessarySwitch).toBeDisabled();
      expect(necessarySwitch).toHaveAttribute("aria-checked", "true");
    });
  });
});
