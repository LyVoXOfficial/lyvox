/**
 * Completeness guard: every client-storage writer in apps/web/src must have
 * a matching entry in STORAGE_INVENTORY.
 *
 * Walk strategy (two-pass per file):
 *   Pass 1 — build a local constant map:  const/let/var NAME = "literal"
 *   Pass 2 — extract setItem keys two ways:
 *     (a) inline literal:   (local|session)Storage.setItem("KEY", …)
 *     (b) const reference:  (local|session)Storage.setItem(NAME, …)  → resolve via map
 *
 * Exclusions:
 *   - paths containing __tests__   (test fixtures that aren't production writers)
 *   - paths containing (protected)/debug/  (dev-only throwaway debug route)
 *   - node_modules, .next
 *
 * If ANY extracted key is NOT covered by STORAGE_INVENTORY the test fails,
 * listing the offending key(s) + file — forcing a future dev to classify them.
 *
 * "Covered" = exact key match OR inventory entry key ends with * and the
 * extracted key starts with that prefix.
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { STORAGE_INVENTORY } from "@/lib/cookieConsent/inventory";

// ── helpers ──────────────────────────────────────────────────────────────────

/** Normalise to forward-slash paths for portable exclusion checks. */
function norm(p: string): string {
  return p.replace(/\\/g, "/");
}

function shouldExclude(filePath: string): boolean {
  const n = norm(filePath);
  return (
    n.includes("/__tests__/") ||
    n.includes("/__tests__\\") ||
    n.includes("__tests__") ||
    n.includes("(protected)/debug/") ||
    n.includes("node_modules") ||
    n.includes("/.next/") ||
    n.includes("\\.next\\")
  );
}

/** Recursively walk a directory, yielding .ts / .tsx file paths. */
function* walkTs(dir: string): Generator<string> {
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
      yield* walkTs(full);
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))
    ) {
      yield full;
    }
  }
}

/**
 * Regex: match string-literal const/let/var declarations.
 * Catches both SCREAMING_SNAKE and camelCase names.
 * Only single-file scope — we don't follow imports.
 */
const CONST_DECL_RE =
  /(?:const|let|var)\s+(\w+)\s*=\s*(?:["'`])([^"'`\n]+)(?:["'`])/g;

/**
 * Regex (a): setItem with an inline string literal.
 * Group 1 = the key string.
 */
const SETITEM_LITERAL_RE =
  /\b(?:local|session)Storage\.setItem\s*\(\s*["'`]([^"'`]+)["'`]/g;

/**
 * Regex (b): setItem with an identifier (not a quote).
 * Group 1 = identifier name.
 */
const SETITEM_IDENT_RE =
  /\b(?:local|session)Storage\.setItem\s*\(\s*([A-Za-z_$][\w$]*)\b(?!\s*["'`])/g;

/**
 * Extract all storage keys written in a single file's source text.
 * Returns a Set<string> of resolved key strings.
 */
function extractKeys(src: string): Set<string> {
  const keys = new Set<string>();

  // Pass 1 — build const-name → string-value map
  const constMap = new Map<string, string>();
  for (const m of src.matchAll(CONST_DECL_RE)) {
    constMap.set(m[1], m[2]);
  }

  // Pass 2a — inline literals
  for (const m of src.matchAll(SETITEM_LITERAL_RE)) {
    keys.add(m[1]);
  }

  // Pass 2b — identifier references → resolve through constMap
  for (const m of src.matchAll(SETITEM_IDENT_RE)) {
    const resolved = constMap.get(m[1]);
    if (resolved !== undefined) {
      keys.add(resolved);
    }
    // If not resolvable (imported constant, computed, etc.) we skip — the
    // test guards what it can statically see; dynamic keys require a code review.
  }

  return keys;
}

/** Check if an inventory entry covers a key (exact or wildcard prefix). */
function isCovered(key: string): boolean {
  return STORAGE_INVENTORY.some((entry) => {
    if (entry.key.endsWith("*")) {
      return key.startsWith(entry.key.slice(0, -1));
    }
    return entry.key === key;
  });
}

// ── locate apps/web/src ──────────────────────────────────────────────────────

// __dirname is the __tests__ directory; src is 3 levels up.
// Fallback to process.cwd() resolution if __dirname is unavailable (ESM).
function srcDir(): string {
  // In CJS (vitest default transform) __dirname is available.
  // In pure ESM it isn't — use process.cwd() which vitest sets to the repo root.
  try {
    // eslint-disable-next-line no-undef
    if (typeof __dirname !== "undefined") {
      // __tests__ → cookieConsent → lib → src
      return path.resolve(__dirname, "../../../");
    }
  } catch {
    // fall through
  }
  return path.resolve(process.cwd(), "apps/web/src");
}

// ── test ─────────────────────────────────────────────────────────────────────

describe("STORAGE_INVENTORY — completeness guard", () => {
  it("every storage key written in apps/web/src is in STORAGE_INVENTORY", () => {
    const dir = srcDir();
    const violations: { key: string; file: string }[] = [];
    const allExtracted: string[] = [];

    for (const filePath of walkTs(dir)) {
      if (shouldExclude(filePath)) continue;
      const src = fs.readFileSync(filePath, "utf8");
      const keys = extractKeys(src);
      for (const key of keys) {
        allExtracted.push(key);
        if (!isCovered(key)) {
          violations.push({ key, file: norm(filePath) });
        }
      }
    }

    // Non-empty assertion: if the walk found zero keys something is broken
    // (regex broken, wrong directory, all files accidentally excluded).
    // We expect at least the 7 production keys to be resolved.
    expect(allExtracted.length).toBeGreaterThan(0);

    if (violations.length > 0) {
      const msg = violations
        .map((v) => `  key="${v.key}"  file=${v.file}`)
        .join("\n");
      throw new Error(
        `The following storage keys are written in source but NOT listed in STORAGE_INVENTORY.\n` +
          `Classify each key (necessary / functional / analytics) and add a row to\n` +
          `apps/web/src/lib/cookieConsent/inventory.ts before merging.\n\n` +
          msg
      );
    }
  });

  it("STORAGE_INVENTORY has at least 5 necessary entries after comparison-instructions-dismissed was added", () => {
    const necessary = STORAGE_INVENTORY.filter(
      (e) => e.category === "necessary"
    );
    expect(necessary.length).toBeGreaterThanOrEqual(5);
  });

  it("comparison-instructions-dismissed is in the inventory as necessary", () => {
    const entry = STORAGE_INVENTORY.find(
      (e) => e.key === "comparison-instructions-dismissed"
    );
    expect(entry).toBeDefined();
    expect(entry?.category).toBe("necessary");
  });
});
