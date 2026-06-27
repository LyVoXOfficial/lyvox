/**
 * Tests for the /legal/cookies page (CookieInventory presentational component).
 *
 * TDD: tests written before implementation.
 * RTL/jsdom, vitest globals.
 *
 * We test the sync CookieInventory component directly (not the async server page)
 * to avoid mocking next/headers.
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CookieInventory } from "../CookieInventory";

// CookieSettingsButton uses useCookieConsent() — stub it with a real button
vi.mock("@/components/cookie/CookieSettingsButton", () => ({
  CookieSettingsButton: ({ label }: { label: string }) => (
    <button type="button">{label}</button>
  ),
}));

// Minimal i18n stubs for the component props
const i18nProps = {
  policyTitle: "cookie.policy_title",
  policyIntro: "cookie.policy_intro",
  draftNote: "cookie.policy_draft_note",
  manageLabel: "cookie.manage",
  necessaryLabel: "cookie.necessary_label",
  functionalLabel: "cookie.functional_label",
  analyticsLabel: "cookie.analytics_label",
};

describe("CookieInventory — /legal/cookies page", () => {
  it("renders the policy title", () => {
    render(<CookieInventory {...i18nProps} />);
    expect(screen.getByText("cookie.policy_title")).toBeTruthy();
  });

  it("renders the draft note", () => {
    render(<CookieInventory {...i18nProps} />);
    expect(screen.getByText("cookie.policy_draft_note")).toBeTruthy();
  });

  it("renders at least one 'necessary' category inventory entry", () => {
    render(<CookieInventory {...i18nProps} />);
    // lyvox_cookie_consent is a non-wildcard necessary entry
    expect(screen.getByText(/lyvox_cookie_consent/i)).toBeTruthy();
  });

  it("renders at least one 'functional' category inventory entry", () => {
    render(<CookieInventory {...i18nProps} />);
    // lyvox:recentlyViewed is a functional entry
    expect(screen.getByText(/lyvox:recentlyViewed/i)).toBeTruthy();
  });

  it("wildcard key 'sb-*' renders gracefully — no raw asterisk in display", () => {
    render(<CookieInventory {...i18nProps} />);
    // sb-* should display as a pattern (e.g. "sb-…") without a literal raw asterisk
    // visible as the sole character after the prefix
    const body = document.body.textContent ?? "";
    // The wildcard asterisk must not appear as a standalone character in the output
    // i.e. the displayed text should NOT contain "sb-*" literally
    expect(body).not.toContain("sb-*");
    // But the sb- prefix must still be visible
    expect(body).toMatch(/sb-/);
  });

  it("wildcard key 'cf-turnstile-*' renders gracefully — no raw asterisk", () => {
    render(<CookieInventory {...i18nProps} />);
    const body = document.body.textContent ?? "";
    expect(body).not.toContain("cf-turnstile-*");
    expect(body).toMatch(/cf-turnstile-/);
  });

  it("renders the 'manage cookie settings' button", () => {
    render(<CookieInventory {...i18nProps} />);
    // CookieSettingsButton should be present (renders a button)
    expect(screen.getByRole("button")).toBeTruthy();
  });
});
