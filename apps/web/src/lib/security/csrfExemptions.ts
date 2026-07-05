/**
 * SEC-CSRF: mutating routes that legitimately do NOT call
 * `assertSameOrigin`/`withCsrfProtection`. Each entry must be justified —
 * this file is read by
 * lib/security/__tests__/route-csrf-completeness.test.ts, which fails CI if
 * a new mutating route.ts appears that is neither CSRF-guarded nor listed
 * here.
 *
 * `path` is the route.ts location relative to apps/web/src/app/api/, using
 * forward slashes, e.g. "billing/webhook/route.ts".
 */
export type CsrfExemption = {
  path: string;
  reason: string;
};

export const CSRF_EXEMPTIONS: CsrfExemption[] = [
  {
    path: "billing/webhook/route.ts",
    reason:
      "Stripe calls this server-to-server with an HMAC-signed body, never a browser with cookies — there is no session for CSRF to ride on, and Stripe never sends an Origin/Sec-Fetch-Site header matching our own host.",
  },
  {
    path: "csp-report/route.ts",
    reason:
      "Unauthenticated, best-effort browser CSP violation reports (report-uri). No session/cookie state is read or mutated on the caller's behalf, so there is nothing for CSRF to forge; kept permissive like its zod exemption.",
  },
];
