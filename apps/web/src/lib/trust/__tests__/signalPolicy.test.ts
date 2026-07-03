import { describe, expect, it } from "vitest";

import en from "@/i18n/locales/en.json";
import ru from "@/i18n/locales/ru.json";
import nl from "@/i18n/locales/nl.json";
import fr from "@/i18n/locales/fr.json";
import de from "@/i18n/locales/de.json";
import { BANNED_TRUST_WORDING, TRUST_SIGNAL_POLICY } from "@/lib/trust/signalPolicy";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = Record<string, JsonValue>;

const locales = {
  en: en as JsonObject,
  ru: ru as JsonObject,
  nl: nl as JsonObject,
  fr: fr as JsonObject,
  de: de as JsonObject,
} as const;

function flattenValues(
  value: JsonValue,
  prefix = "",
  output: Record<string, string> = {},
): Record<string, string> {
  if (typeof value === "string") {
    output[prefix] = value;
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenValues(item, `${prefix}[${index}]`, output));
    return output;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      flattenValues(child, prefix ? `${prefix}.${key}` : key, output);
    }
  }

  return output;
}

function hasKey(messages: JsonObject, dottedKey: string): boolean {
  let current: JsonValue = messages;
  for (const segment of dottedKey.split(".")) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return false;
    }
    current = current[segment];
  }
  return typeof current === "string";
}

describe("TRUST_SIGNAL_POLICY", () => {
  it("references i18n keys that exist in every locale", () => {
    const missing: string[] = [];

    for (const [signal, policy] of Object.entries(TRUST_SIGNAL_POLICY)) {
      for (const key of [policy.i18nKey, policy.explanationI18nKey]) {
        for (const [locale, messages] of Object.entries(locales)) {
          if (!hasKey(messages, key)) {
            missing.push(`${signal}: ${key} missing in ${locale}`);
          }
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("keeps banned trust wording out of localized UI strings", () => {
    const violations: string[] = [];
    const banned = BANNED_TRUST_WORDING.map((phrase) => phrase.toLocaleLowerCase());

    for (const [locale, messages] of Object.entries(locales)) {
      for (const [key, value] of Object.entries(flattenValues(messages))) {
        const normalized = value.toLocaleLowerCase();
        for (const phrase of banned) {
          if (normalized.includes(phrase)) {
            violations.push(`${locale}.${key}: contains "${phrase}"`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
