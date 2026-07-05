/**
 * SEC-ENV completeness guard: no source file under apps/web/src may (a) reference a
 * NEXT_PUBLIC_ env var whose name is secret-shaped, or (b) be a "use client" component
 * importing supabaseService. Real-tree scan + synthetic positive-detection fixtures
 * (mirrors authz-migration-guard.test.ts / route-validation-completeness.test.ts).
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  findPublicSecretLeaks,
  findClientServiceRoleImports,
  type PseudoFile,
} from "@/lib/security/envHygieneGuard";

function norm(p: string): string {
  return p.replace(/\\/g, "/");
}

function* walkSourceFiles(dir: string): Generator<string> {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".turbo")
        continue;
      yield* walkSourceFiles(full);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      yield full;
    }
  }
}

function srcDir(): string {
  try {
    // eslint-disable-next-line no-undef
    if (typeof __dirname !== "undefined") {
      return path.resolve(__dirname, "../../..");
    }
  } catch {
    // fall through
  }
  return path.resolve(process.cwd(), "apps/web/src");
}

function loadRealFiles(dir: string): PseudoFile[] {
  const files: PseudoFile[] = [];
  for (const filePath of walkSourceFiles(dir)) {
    files.push({
      path: norm(path.relative(dir, filePath)),
      source: fs.readFileSync(filePath, "utf8"),
    });
  }
  return files;
}

describe("secret hygiene guard", () => {
  const dir = srcDir();
  const realFiles = loadRealFiles(dir);

  it("scans a non-trivial number of files (walk sanity check)", () => {
    expect(realFiles.length).toBeGreaterThanOrEqual(100);
  });

  it("no real file references a secret-shaped NEXT_PUBLIC_ env var", () => {
    const violations = findPublicSecretLeaks(realFiles);
    if (violations.length > 0) {
      const msg = violations.map((v) => `  ${v.path}: ${v.message}`).join("\n");
      throw new Error(`Secret-shaped NEXT_PUBLIC_ env var(s) found:\n\n${msg}`);
    }
  });

  it("no real 'use client' file imports supabaseService", () => {
    const violations = findClientServiceRoleImports(realFiles);
    if (violations.length > 0) {
      const msg = violations.map((v) => `  ${v.path}: ${v.message}`).join("\n");
      throw new Error(`Client-side service-role import(s) found:\n\n${msg}`);
    }
  });

  // ── positive-detection fixtures ──────────────────────────────────────────
  // The two checks above only prove "no violations exist today"; these prove the
  // detector actually detects, so the real-tree assertions aren't vacuously true.

  it("detects a secret-shaped NEXT_PUBLIC_ var in a synthetic fixture", () => {
    // Built via concatenation so this fixture string itself doesn't trip the
    // real-tree scan above when this test file is walked as source.
    const badVarName = ["NEXT_PUBLIC", "STRIPE", "SECRET_KEY"].join("_");
    const bad: PseudoFile[] = [
      {
        path: "fixtures/bad-public-secret.ts",
        source: `const key = process.env.${badVarName};`,
      },
    ];
    const violations = findPublicSecretLeaks(bad);
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe("fixtures/bad-public-secret.ts");
  });

  it("does not flag legitimately public NEXT_PUBLIC_ vars", () => {
    const good: PseudoFile[] = [
      {
        path: "fixtures/good-public.ts",
        source: [
          `const url = process.env.NEXT_PUBLIC_SUPABASE_URL;`,
          `const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;`,
          `const site = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;`,
        ].join("\n"),
      },
    ];
    expect(findPublicSecretLeaks(good)).toHaveLength(0);
  });

  it("detects a 'use client' component importing supabaseService in a synthetic fixture", () => {
    const bad: PseudoFile[] = [
      {
        path: "fixtures/BadClientComponent.tsx",
        source: [
          `"use client";`,
          ``,
          `import { supabaseService } from "@/lib/supabaseService";`,
          `export function Bad() { return null; }`,
        ].join("\n"),
      },
    ];
    const violations = findClientServiceRoleImports(bad);
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe("fixtures/BadClientComponent.tsx");
  });

  it("does not flag a server component importing supabaseService", () => {
    const good: PseudoFile[] = [
      {
        path: "fixtures/GoodServerComponent.tsx",
        source: [
          `import { supabaseService } from "@/lib/supabaseService";`,
          `export async function Good() { return null; }`,
        ].join("\n"),
      },
    ];
    expect(findClientServiceRoleImports(good)).toHaveLength(0);
  });
});
