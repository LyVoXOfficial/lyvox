/**
 * SEC-CSP · Content-Security-Policy builder (nonce + strict-dynamic).
 *
 * Moves CSP off the static `next.config.ts` `headers()` (which cannot vary a
 * nonce per request) and into `middleware.ts`, where a fresh nonce is minted
 * for every request. Next.js 16 reads that nonce from the request-side
 * `Content-Security-Policy` header (`getScriptNonceFromHeader`) and stamps it
 * onto its bootstrap/streaming scripts, so we can drop `'unsafe-inline'` and
 * `'unsafe-eval'` from `script-src` entirely.
 *
 * Two-phase rollout (matches the TZ "observe → enforce"):
 *  - Default is **report-only** — the browser reports violations but blocks
 *    nothing. The policy SHAPE changed (nonce/strict-dynamic vs the old
 *    unsafe-* allowlist), so the new policy must be re-observed against real
 *    prod traffic before enforcing.
 *  - Flip `CSP_MODE=enforce` (env) only after `/api/csp-report` is clean across
 *    every route + third-party surface. See {@link resolveCspMode}.
 *
 * Verify the enforced policy on PROD, never on `next dev`: Turbopack HMR uses
 * eval/inline that production output does not, so dev report-only lies (RULE-04).
 */

export type CspMode = "enforce" | "report-only";

/**
 * Resolve the delivery mode from the environment. **Fail-safe:** anything other
 * than the exact string `"enforce"` (unset, garbage, wrong case) resolves to
 * `report-only`, so a typo or missing var can never silently start blocking
 * scripts in production.
 */
export function resolveCspMode(env: Record<string, string | undefined> = process.env): CspMode {
  return env.CSP_MODE === "enforce" ? "enforce" : "report-only";
}

/** The response header name for the given mode. */
export function cspHeaderName(mode: CspMode): string {
  return mode === "enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
}

/**
 * Build the policy string for a single request's `nonce`.
 *
 * `script-src` is `'self' 'nonce-…' 'strict-dynamic'` — no `'unsafe-inline'`,
 * no `'unsafe-eval'`. Under `'strict-dynamic'` the host allowlist is ignored by
 * modern browsers (trust propagates from the nonced bootstrap), so third-party
 * scripts (Turnstile via next/script, Vercel Analytics, Stripe.js when added)
 * load through nonce propagation rather than host entries.
 *
 * `style-src` deliberately keeps `'unsafe-inline'` — SEC-CSP targets script
 * execution only; nonce-ing Tailwind/next-font inline styles is out of scope.
 */
export function buildCsp(nonce: string): string {
  const directives = [
    "default-src 'self'",
    // Nonce + strict-dynamic. No unsafe-inline / unsafe-eval (SEC-CSP acceptance).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Styles stay permissive — nonce-ing inline styles is explicitly out of scope.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://*.stripe.com",
    "font-src 'self' data:",
    // Browser egress. challenges.cloudflare.com → Turnstile widget XHR;
    // *.sentry.io → @sentry/nextjs browser envelope POST (covers ingest region
    // variants o<org>.ingest.{us,de}.sentry.io). Supabase REST + realtime and
    // the server-only Stripe/Upstash hosts are kept as-is.
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.upstash.io https://challenges.cloudflare.com https://*.sentry.io",
    // Turnstile renders its challenge in an iframe from challenges.cloudflare.com
    // — without this the register flow 403s (verified break). Stripe frames kept
    // for future Checkout/Elements.
    "frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Keep collecting violations through both phases (observation continues even
    // after enforce, so regressions surface).
    "report-uri /api/csp-report",
  ];
  return directives.join("; ");
}

/**
 * Mint a per-request nonce. Edge-runtime safe: uses Web Crypto + `btoa`, both
 * present in the Next.js edge and Node runtimes (avoids `Buffer`, which is not
 * guaranteed in edge middleware).
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
