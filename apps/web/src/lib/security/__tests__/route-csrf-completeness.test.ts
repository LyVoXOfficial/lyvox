/**
 * SEC-CSRF completeness guard: every mutating API route (POST/PUT/PATCH/
 * DELETE handler) under apps/web/src/app/api must either call
 * `assertSameOrigin`/`withCsrfProtection` (from lib/security/csrf) or be
 * explicitly listed in CSRF_EXEMPTIONS with a documented reason. Mirrors
 * lib/validations/__tests__/route-validation-completeness.test.ts.
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { CSRF_EXEMPTIONS } from "@/lib/security/csrfExemptions";

function norm(p: string): string {
  return p.replace(/\\/g, "/");
}

function* walkRouteFiles(dir: string): Generator<string> {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".turbo") continue;
      yield* walkRouteFiles(full);
    } else if (entry.isFile() && entry.name === "route.ts") {
      yield full;
    }
  }
}

const MUTATING_HANDLER_RE = /export\s+(?:async\s+function|const)\s+(POST|PUT|PATCH|DELETE)\b/;
const CSRF_IMPORT_RE = /from\s+["']@\/lib\/security\/csrf["']/;
const CSRF_CALL_RE = /assertSameOrigin\(|withCsrfProtection\(/;

function hasMutatingHandler(src: string): boolean {
  return MUTATING_HANDLER_RE.test(src);
}

function usesCsrfGuard(src: string): boolean {
  return CSRF_IMPORT_RE.test(src) && CSRF_CALL_RE.test(src);
}

function apiDir(): string {
  try {
    // eslint-disable-next-line no-undef
    if (typeof __dirname !== "undefined") {
      return path.resolve(__dirname, "../../../app/api");
    }
  } catch {
    // fall through
  }
  return path.resolve(process.cwd(), "apps/web/src/app/api");
}

describe("route CSRF-guard completeness", () => {
  const dir = apiDir();

  it("every mutating route.ts either calls the CSRF guard or is exempted", () => {
    const violations: string[] = [];
    const scanned: string[] = [];

    for (const filePath of walkRouteFiles(dir)) {
      const relPath = norm(path.relative(dir, filePath));
      scanned.push(relPath);

      const src = fs.readFileSync(filePath, "utf8");
      if (!hasMutatingHandler(src)) continue;

      const exempted = CSRF_EXEMPTIONS.some((e) => e.path === relPath);
      if (exempted) continue;

      if (!usesCsrfGuard(src)) {
        violations.push(relPath);
      }
    }

    expect(scanned.length).toBeGreaterThanOrEqual(25);

    if (violations.length > 0) {
      const msg = violations.map((v) => `  ${v}`).join("\n");
      throw new Error(
        `The following mutating route.ts files have no CSRF guard and are\n` +
          `not listed in CSRF_EXEMPTIONS:\n\n${msg}\n\n` +
          `Fix by either:\n` +
          `  1. Calling assertSameOrigin(req)/withCsrfProtection(handler) from\n` +
          `     @/lib/security/csrf in the handler, or\n` +
          `  2. Adding a justified entry to\n` +
          `     apps/web/src/lib/security/csrfExemptions.ts\n` +
          `     explaining why the check does not apply.`,
      );
    }
  });

  it("every CSRF_EXEMPTIONS entry points to a route.ts that still exists", () => {
    const stale = CSRF_EXEMPTIONS.filter((e) => !fs.existsSync(path.join(dir, e.path)));
    if (stale.length > 0) {
      const msg = stale.map((e) => `  ${e.path}`).join("\n");
      throw new Error(
        `The following CSRF_EXEMPTIONS entries reference route.ts files that no\n` +
          `longer exist. Remove or fix these entries in\n` +
          `apps/web/src/lib/security/csrfExemptions.ts:\n\n${msg}`,
      );
    }
  });

  it("every CSRF_EXEMPTIONS entry has a documented reason", () => {
    const undocumented = CSRF_EXEMPTIONS.filter((e) => !e.reason || e.reason.trim().length <= 10);
    if (undocumented.length > 0) {
      const msg = undocumented.map((e) => `  ${e.path}`).join("\n");
      throw new Error(
        `The following CSRF_EXEMPTIONS entries lack a sufficiently documented\n` +
          `reason (must be > 10 chars):\n\n${msg}`,
      );
    }
  });
});
