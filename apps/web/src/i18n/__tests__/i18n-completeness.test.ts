import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

import en from "../locales/en.json";
import ru from "../locales/ru.json";
import nl from "../locales/nl.json";
import fr from "../locales/fr.json";
import de from "../locales/de.json";

// src root, resolved relative to this test file (robust to cwd)
const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

type Json = Record<string, unknown>;
function flatten(obj: Json, prefix = "", acc: Record<string, true> = {}): Record<string, true> {
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const nk = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v as Json, nk, acc);
    else acc[nk] = true;
  }
  return acc;
}

const enKeys = flatten(en as Json);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (!/node_modules|\.next|__tests__/.test(p)) walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\./.test(name)) {
      out.push(p);
    }
  }
  return out;
}

// SCOPE: this guard prevents the systemic failure that caused the 2026-06-26 i18n incident —
// (a) referencing a translation key that is missing from the locale files, and (b) locale drift
// (a key present in one locale but not another). It does NOT detect newly-added hardcoded English
// JSX literals (`<p>Some text</p>`): a reliable detector would flag pre-existing literals across the
// whole tree and could not pass green without an allowlist. Hardcoded literals also degrade to
// readable English, whereas a missing key can render a raw dotted key — the worse mode this catches.
// Known blind spot: dynamically-built keys (`t(`...${x}`)`) are not statically verifiable.
//
// Matches t("a.b") / tr("a.b") / tf("a.b") / translate("a.b") — static dotted-key literals only.
// Hyphens are allowed in segments (e.g. `comparison.condition.like-new`).
const KEY_RE = /\b(?:t|tr|tf|translate)\(\s*(["'])([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+)\1/g;

describe("i18n completeness", () => {
  it("every translation key referenced in source exists in en.json", () => {
    const missing = new Map<string, Set<string>>();
    for (const file of walk(SRC_ROOT)) {
      const src = readFileSync(file, "utf8");
      let m: RegExpExecArray | null;
      while ((m = KEY_RE.exec(src))) {
        const key = m[2];
        if (!enKeys[key]) {
          const rel = file.slice(SRC_ROOT.length + 1).split("\\").join("/");
          if (!missing.has(key)) missing.set(key, new Set());
          missing.get(key)!.add(rel);
        }
      }
    }
    const report = [...missing.entries()].map(([k, files]) => `  ${k}  <- ${[...files].join(", ")}`).join("\n");
    expect(missing.size, `Referenced i18n keys missing from en.json:\n${report}`).toBe(0);
  });

  it("ru/nl/fr/de have the same key set as en (no drift)", () => {
    const base = Object.keys(enKeys).sort();
    for (const [name, msgs] of [["ru", ru], ["nl", nl], ["fr", fr], ["de", de]] as const) {
      const keys = flatten(msgs as Json);
      const missing = base.filter((k) => !keys[k]);
      const extra = Object.keys(keys).filter((k) => !enKeys[k]);
      expect(missing, `${name}.json missing keys present in en.json:\n  ${missing.join("\n  ")}`).toEqual([]);
      expect(extra, `${name}.json has keys not in en.json:\n  ${extra.join("\n  ")}`).toEqual([]);
    }
  });
});
