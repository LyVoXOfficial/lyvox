import { describe, expect, it } from "vitest";
import {
  buildCsp,
  cspHeaderName,
  generateNonce,
  resolveCspMode,
} from "@/lib/security/csp";

// Pull one directive line out of the joined policy string for focused assertions.
function directive(csp: string, name: string): string {
  const line = csp.split(";").map((d) => d.trim()).find((d) => d === name || d.startsWith(`${name} `));
  return line ?? "";
}

describe("buildCsp", () => {
  const nonce = "TESTNONCE123";
  const csp = buildCsp(nonce);

  it("script-src is nonce + strict-dynamic and carries NO unsafe-inline/unsafe-eval (SEC-CSP acceptance)", () => {
    const scriptSrc = directive(csp, "script-src");
    expect(scriptSrc).toContain(`'nonce-${nonce}'`);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it("keeps report-uri so the observation phase still collects violations", () => {
    expect(directive(csp, "report-uri")).toBe("report-uri /api/csp-report");
  });

  it("allows the Cloudflare Turnstile challenge iframe (would 403 the register flow otherwise)", () => {
    // Verdict verify:third-party — Turnstile renders a challenge iframe from this
    // host; missing frame-src = blocked widget = CAPTCHA_FAILED on register.
    expect(directive(csp, "frame-src")).toContain("https://challenges.cloudflare.com");
  });

  it("allows Turnstile + Sentry browser egress under connect-src", () => {
    const connectSrc = directive(csp, "connect-src");
    expect(connectSrc).toContain("https://challenges.cloudflare.com");
    expect(connectSrc).toContain("https://*.sentry.io"); // @sentry/nextjs browser envelope POST
    // Regression guard: existing Supabase egress must survive the rewrite.
    expect(connectSrc).toContain("https://*.supabase.co");
    expect(connectSrc).toContain("wss://*.supabase.co");
  });

  it("keeps 'unsafe-inline' on style-src — SEC-CSP targets script-src only, not styles", () => {
    expect(directive(csp, "style-src")).toContain("'unsafe-inline'");
  });

  it("preserves the existing hardening directives (no regression on the lockdown set)", () => {
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
    expect(directive(csp, "form-action")).toBe("form-action 'self'");
    expect(directive(csp, "default-src")).toBe("default-src 'self'");
  });
});

describe("cspHeaderName", () => {
  it("emits the enforcing header name in enforce mode", () => {
    expect(cspHeaderName("enforce")).toBe("Content-Security-Policy");
  });

  it("emits the observe-only header name in report-only mode", () => {
    expect(cspHeaderName("report-only")).toBe("Content-Security-Policy-Report-Only");
  });
});

describe("resolveCspMode", () => {
  it("enforces ONLY on an exact CSP_MODE=enforce opt-in", () => {
    expect(resolveCspMode({ CSP_MODE: "enforce" })).toBe("enforce");
  });

  it("is fail-safe: unset defaults to report-only (never accidentally block prod)", () => {
    expect(resolveCspMode({})).toBe("report-only");
  });

  it("is fail-safe: garbage / wrong-case values default to report-only", () => {
    expect(resolveCspMode({ CSP_MODE: "report-only" })).toBe("report-only");
    expect(resolveCspMode({ CSP_MODE: "ENFORCE" })).toBe("report-only");
    expect(resolveCspMode({ CSP_MODE: "on" })).toBe("report-only");
    expect(resolveCspMode({ CSP_MODE: "true" })).toBe("report-only");
  });
});

describe("generateNonce", () => {
  it("returns a non-empty base64 token", () => {
    const nonce = generateNonce();
    expect(nonce.length).toBeGreaterThan(0);
    expect(nonce).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it("is unique per call (per-request freshness)", () => {
    expect(generateNonce()).not.toBe(generateNonce());
  });
});
