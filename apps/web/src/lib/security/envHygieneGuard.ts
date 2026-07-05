/**
 * SEC-ENV — static analyzer for two secret-hygiene classes this project has no
 * automated guard against (gitleaks scans committed secret *values*; it does not
 * understand these two architectural mistakes):
 *
 *   1. A `NEXT_PUBLIC_*` env var whose name looks secret-shaped (SECRET, SERVICE_ROLE,
 *      PRIVATE, WEBHOOK, PASSWORD, AUTH_TOKEN, ACCOUNT_SID, ...). `NEXT_PUBLIC_` vars are
 *      inlined into the client bundle at build time — naming one this way ships the
 *      secret to every browser regardless of its actual value at scan time.
 *   2. A `"use client"` file importing `supabaseService` (the service-role client).
 *      `supabaseService.ts` already carries `import "server-only"`, which hard-fails
 *      the *build* if bundled client-side — this guard catches the same mistake at
 *      *lint/test* time with a clearer message, and covers any future server-only
 *      module that forgets the `server-only` import.
 *
 * Pure and dependency-free (mirrors authzMigrationGuard.ts / routeValidationExemptions
 * pattern) so it can be unit-tested against both the real source tree and synthetic
 * "bad file" fixtures for positive-detection.
 */

export interface PseudoFile {
  /** Relative path (e.g. "components/Foo.tsx"), used in violation messages. */
  path: string;
  /** Raw source text. */
  source: string;
}

export interface SecretHygieneViolation {
  kind: "public-secret-name" | "client-service-role-import";
  path: string;
  message: string;
}

/**
 * Substrings that mark an env var name as secret-shaped. Deliberately narrow
 * (not a blanket `KEY`/`TOKEN` match) — `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are intentionally public and must not false-fail.
 */
const SECRET_NAME_MARKERS = [
  "SECRET",
  "SERVICE_ROLE",
  "PRIVATE",
  "WEBHOOK",
  "PASSWORD",
  "AUTH_TOKEN",
  "ACCOUNT_SID",
];

const NEXT_PUBLIC_VAR_RE = /\bNEXT_PUBLIC_[A-Z0-9_]+\b/g;

export function findPublicSecretLeaks(files: PseudoFile[]): SecretHygieneViolation[] {
  const violations: SecretHygieneViolation[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    for (const match of file.source.matchAll(NEXT_PUBLIC_VAR_RE)) {
      const name = match[0];
      const key = `${file.path}:${name}`;
      if (seen.has(key)) continue;
      if (!SECRET_NAME_MARKERS.some((marker) => name.includes(marker))) continue;
      seen.add(key);
      violations.push({
        kind: "public-secret-name",
        path: file.path,
        message:
          `${file.path} references "${name}" — a NEXT_PUBLIC_ env var whose name looks ` +
          `secret-shaped. NEXT_PUBLIC_ vars are inlined into the client bundle at build time; ` +
          `rename it without the NEXT_PUBLIC_ prefix and read it only in server code, or if it is ` +
          `genuinely safe to expose (e.g. a site key, not a secret key), rename it to avoid the ` +
          `SECRET/SERVICE_ROLE/PRIVATE/WEBHOOK/PASSWORD/AUTH_TOKEN/ACCOUNT_SID markers.`,
      });
    }
  }

  return violations;
}

const USE_CLIENT_RE = /^\s*["']use client["'];?/;
const SERVICE_ROLE_IMPORT_RE = /from\s+["'][^"']*supabaseService["']/;

export function findClientServiceRoleImports(files: PseudoFile[]): SecretHygieneViolation[] {
  const violations: SecretHygieneViolation[] = [];

  for (const file of files) {
    if (!USE_CLIENT_RE.test(file.source)) continue;
    if (!SERVICE_ROLE_IMPORT_RE.test(file.source)) continue;
    violations.push({
      kind: "client-service-role-import",
      path: file.path,
      message:
        `${file.path} is a "use client" component importing supabaseService (the ` +
        `service-role Supabase client, which bypasses RLS). Service-role access must stay ` +
        `server-only — fetch the data via a Server Component/API route instead.`,
    });
  }

  return violations;
}
