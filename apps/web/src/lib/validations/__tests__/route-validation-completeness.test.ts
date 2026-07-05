/**
 * Completeness guard: every mutating API route (POST/PUT/PATCH/DELETE
 * handler) under apps/web/src/app/api must either use zod validation
 * (a zod-related import + a validation call) or be explicitly listed
 * in ROUTE_VALIDATION_EXEMPTIONS with a documented reason.
 *
 * Walk strategy:
 *   Recursively walk apps/web/src/app/api, collecting only route.ts files
 *   (skipping node_modules/.next/.turbo).
 *
 * Detection:
 *   - A route.ts is "mutating" if it exports POST/PUT/PATCH/DELETE via
 *     `export async function X` or `export const X`.
 *   - A mutating route "passes" if it is listed in
 *     ROUTE_VALIDATION_EXEMPTIONS (exact relative-path match), OR its
 *     source contains BOTH a zod-related import (`from "zod"` or
 *     `from "@/lib/validations"`) AND a validation call
 *     (`.safeParse(` or `validateRequest(`).
 *
 * If ANY mutating route.ts fails both conditions the test fails, listing
 * the offending path(s) and instructing the developer to either add a
 * zod schema + validateRequest/safeParse call, or add a justified entry
 * to ROUTE_VALIDATION_EXEMPTIONS.
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { ROUTE_VALIDATION_EXEMPTIONS } from "@/lib/validations/routeValidationExemptions";

// ── helpers ──────────────────────────────────────────────────────────────────

/** Normalise to forward-slash paths for portable comparisons. */
function norm(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Recursively walk a directory, yielding route.ts file paths. */
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
      if (
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === ".turbo"
      )
        continue;
      yield* walkRouteFiles(full);
    } else if (entry.isFile() && entry.name === "route.ts") {
      yield full;
    }
  }
}

/** Regex: exported mutating handlers (function or const form). */
const MUTATING_HANDLER_RE =
  /export\s+(?:async\s+function|const)\s+(POST|PUT|PATCH|DELETE)\b/;

/** Regex: zod-related import (from "zod" or from "@/lib/validations"). */
const ZOD_IMPORT_RE = /from\s+["'](zod|@\/lib\/validations[^"']*)["']/;

/** Regex: an actual validation call site. */
const VALIDATION_CALL_RE = /\.safeParse\(|validateRequest\(/;

function hasMutatingHandler(src: string): boolean {
  return MUTATING_HANDLER_RE.test(src);
}

function usesZodValidation(src: string): boolean {
  return ZOD_IMPORT_RE.test(src) && VALIDATION_CALL_RE.test(src);
}

// ── locate apps/web/src/app/api ────────────────────────────────────────────

// __dirname is the __tests__ directory; the api dir is 4 levels up:
// __tests__ → validations → lib → src → app/api
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

// ── test ─────────────────────────────────────────────────────────────────────

describe("route validation completeness guard", () => {
  const dir = apiDir();

  it("every mutating route.ts either uses zod validation or is exempted", () => {
    const violations: string[] = [];
    const scanned: string[] = [];

    for (const filePath of walkRouteFiles(dir)) {
      const relPath = norm(path.relative(dir, filePath));
      scanned.push(relPath);

      const src = fs.readFileSync(filePath, "utf8");
      if (!hasMutatingHandler(src)) continue;

      const exempted = ROUTE_VALIDATION_EXEMPTIONS.some(
        (e) => e.path === relPath
      );
      if (exempted) continue;

      if (!usesZodValidation(src)) {
        violations.push(relPath);
      }
    }

    // Sanity assertion: guard against the walk silently finding zero files.
    expect(scanned.length).toBeGreaterThanOrEqual(25);

    if (violations.length > 0) {
      const msg = violations.map((v) => `  ${v}`).join("\n");
      throw new Error(
        `The following mutating route.ts files have no zod validation and\n` +
          `are not listed in ROUTE_VALIDATION_EXEMPTIONS:\n\n${msg}\n\n` +
          `Fix by either:\n` +
          `  1. Adding a zod schema + calling validateRequest(...)/schema.safeParse(...)\n` +
          `     in the handler, or\n` +
          `  2. Adding a justified entry to\n` +
          `     apps/web/src/lib/validations/routeValidationExemptions.ts\n` +
          `     explaining why no body validation is needed.`
      );
    }
  });

  it("every ROUTE_VALIDATION_EXEMPTIONS entry points to a route.ts that still exists", () => {
    const stale: string[] = [];

    for (const entry of ROUTE_VALIDATION_EXEMPTIONS) {
      const full = path.join(dir, entry.path);
      if (!fs.existsSync(full)) {
        stale.push(entry.path);
      }
    }

    if (stale.length > 0) {
      const msg = stale.map((p) => `  ${p}`).join("\n");
      throw new Error(
        `The following ROUTE_VALIDATION_EXEMPTIONS entries reference route.ts\n` +
          `files that no longer exist (deleted/renamed route?). Remove or fix\n` +
          `these entries in apps/web/src/lib/validations/routeValidationExemptions.ts:\n\n${msg}`
      );
    }
  });

  it("every ROUTE_VALIDATION_EXEMPTIONS entry has a documented reason", () => {
    const undocumented = ROUTE_VALIDATION_EXEMPTIONS.filter(
      (e) => !e.reason || e.reason.trim().length <= 10
    );

    if (undocumented.length > 0) {
      const msg = undocumented.map((e) => `  ${e.path}`).join("\n");
      throw new Error(
        `The following ROUTE_VALIDATION_EXEMPTIONS entries lack a sufficiently\n` +
          `documented reason (must be > 10 chars):\n\n${msg}`
      );
    }
  });
});
