/**
 * FLAG-05 · Single source of truth for environment validation.
 *
 * Keys were previously scattered across `process.env.*` reads, several of which
 * degrade silently when unset (Upstash → rate-limiter no-op, Turnstile → skip).
 * Convenient in dev, dangerous in prod: SEC-RL2 documents how a missing
 * `UPSTASH_*` pair silently disables *every* rate limit with only a
 * `console.warn`. This module makes the failure loud where it matters.
 *
 * Design constraints:
 *  - **Never runs at import time.** Validation happens only when `validateEnv`
 *    / `assertEnvOnBoot` are called (from `instrumentation.register()`), so it
 *    cannot throw during `next build` when critical keys are legitimately absent.
 *  - **Pure and injectable.** `validateEnv(env)` takes the env map (default
 *    `process.env`) and returns a plain report — no globals mutated, no throw —
 *    mirroring `isCapabilityEnabled(cap, env)` so tests need no global munging.
 *  - **Hard-fail only in real production.** See {@link isHardFailEnv}.
 */
import { z } from "zod";

type EnvMap = Record<string, string | undefined>;

/**
 * True only for a *real* production deployment, where silently-disabled limits
 * are unacceptable and boot must hard-fail on missing critical keys.
 *
 * On Vercel we key off `VERCEL_ENV` so that **preview** and **development**
 * deploys — which run with `NODE_ENV==='production'` but may legitimately lack
 * Upstash — do NOT hard-fail. Off Vercel (self-host, CI, Docker) we fall back
 * to `NODE_ENV`. `test` and `development` never hard-fail.
 */
export function isHardFailEnv(env: EnvMap = process.env): boolean {
  if (env.VERCEL_ENV) return env.VERCEL_ENV === "production";
  return env.NODE_ENV === "production";
}

/** A required key: absent → the app is broken, in every environment. */
const ALWAYS_CRITICAL = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

/**
 * Critical **only in a hard-fail (production) environment**. Absent in dev is
 * fine (rate-limiter no-ops for local convenience); absent in prod is the exact
 * SEC-RL2 hole — limits silently off — so prod must refuse to boot.
 */
const CRITICAL_IN_PROD = ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"] as const;

/**
 * Non-critical integrations. Each degrades gracefully when unset; we surface an
 * explicit warning (FLAG-05 acceptance: "список некритичных деградаций явный")
 * but never block boot. `detail` documents what stops working.
 */
const OPTIONAL_DEGRADATIONS: ReadonlyArray<{ key: string; detail: string }> = [
  { key: "STRIPE_SECRET_KEY", detail: "billing (boost + Pro) checkout/subscribe disabled" },
  { key: "STRIPE_WEBHOOK_SECRET", detail: "Stripe webhook signature verification disabled" },
  { key: "TURNSTILE_SECRET_KEY", detail: "bot protection skipped on register/OTP" },
  { key: "SENTRY_DSN", detail: "server error tracking disabled" },
  { key: "RESEND_API_KEY", detail: "email via Resend disabled (may fall back to SendGrid)" },
  { key: "SENDGRID_API_KEY", detail: "email via SendGrid disabled" },
  { key: "CRON_SECRET", detail: "all cron endpoints reject (fail-closed 401)" },
  { key: "TWILIO_ACCOUNT_SID", detail: "SMS OTP send disabled" },
  { key: "TWILIO_AUTH_TOKEN", detail: "SMS OTP send disabled" },
];

/**
 * Shape documentation for the critical surface. We keep the zod schema loose
 * (`optional`) and drive the actual pass/fail off {@link isHardFailEnv} in code,
 * because the *same* physical env (Upstash) is critical in prod yet optional in
 * dev — a static schema cannot express that conditional. The schema stays as
 * living documentation and a typed accessor for the always-required keys.
 */
export const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
});

export type EnvReport = {
  ok: boolean;
  /** Whether this environment must hard-fail (throw) on missing critical keys. */
  hardFail: boolean;
  /** Critical keys that are absent given the current environment. */
  missingCritical: string[];
  /** Human-readable notes about degraded optional integrations + malformed values. */
  warnings: string[];
};

const isBlank = (v: string | undefined): boolean => v === undefined || v.trim() === "";

/**
 * Pure environment audit. Never throws, never mutates. Callers decide what to
 * do with the report ({@link assertEnvOnBoot} throws in prod; a status endpoint
 * could render it).
 */
export function validateEnv(env: EnvMap = process.env): EnvReport {
  const hardFail = isHardFailEnv(env);
  const missingCritical: string[] = [];
  const warnings: string[] = [];

  for (const key of ALWAYS_CRITICAL) {
    if (isBlank(env[key])) missingCritical.push(key);
  }

  // Upstash is critical only where we hard-fail; elsewhere it's a warned degradation.
  for (const key of CRITICAL_IN_PROD) {
    if (isBlank(env[key])) {
      if (hardFail) missingCritical.push(key);
      else warnings.push(`${key} not set — rate limiting is a no-op (dev convenience).`);
    }
  }

  for (const { key, detail } of OPTIONAL_DEGRADATIONS) {
    if (isBlank(env[key])) warnings.push(`${key} not set — ${detail}.`);
  }

  // Surface malformed (present-but-invalid) values without ever hard-failing on
  // shape alone — presence is the boot gate; shape is advisory.
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!isBlank(env[key])) warnings.push(`${key} is set but invalid: ${issue.message}.`);
    }
  }

  return { ok: missingCritical.length === 0, hardFail, missingCritical, warnings };
}

/**
 * Boot-time gate. Call once from `instrumentation.register()`.
 * - Hard-fail env + missing critical → **throws** (server refuses to start).
 * - Otherwise → logs missing-critical (dev) and degradation warnings, continues.
 */
export function assertEnvOnBoot(env: EnvMap = process.env): void {
  const report = validateEnv(env);

  if (report.warnings.length > 0) {
    console.warn(`[env] ${report.warnings.length} degraded/optional integration(s):`);
    for (const w of report.warnings) console.warn(`[env]   • ${w}`);
  }

  if (report.missingCritical.length === 0) return;

  const message =
    `[env] Missing critical environment variable(s): ${report.missingCritical.join(", ")}. ` +
    `See apps/web/src/lib/env.ts (FLAG-05).`;

  if (report.hardFail) {
    // Loud, fatal — production must not run with silently-disabled limits (SEC-RL2).
    throw new Error(message);
  }

  console.warn(message);
}
