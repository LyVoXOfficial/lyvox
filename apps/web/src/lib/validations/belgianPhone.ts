import { parsePhoneNumberFromString } from "libphonenumber-js/max";

/**
 * Result of validating + normalizing an input phone number against the
 * Belgium-only marketplace policy.
 *
 * - `format`     : could not be parsed / is not a valid number at all
 * - `not_be`     : valid number, but not a Belgian one
 * - `not_mobile` : valid Belgian number, but not a mobile line
 */
export type BelgianPhoneResult =
  | { ok: true; e164: string }
  | { ok: false; reason: "format" | "not_be" | "not_mobile" };

/**
 * Parse and validate an input as a Belgian MOBILE number.
 *
 * Accepts national (`0470 12 34 56`), international (`+32 470 …`) and the
 * `0032…` forms — `libphonenumber-js` normalizes all of them to canonical
 * E.164 (`+324701234…`). Uses the `/max` metadata bundle because the default
 * (min) metadata ships WITHOUT type patterns, which makes `getType()` return
 * `undefined` for every number and silently breaks mobile detection.
 */
export function parseBelgianMobile(input: string): BelgianPhoneResult {
  const phoneNumber = parsePhoneNumberFromString(input, "BE");

  if (!phoneNumber || !phoneNumber.isValid()) {
    return { ok: false, reason: "format" };
  }

  if (phoneNumber.country !== "BE") {
    return { ok: false, reason: "not_be" };
  }

  const type = phoneNumber.getType();
  const isMobile = type === "MOBILE" || type === "FIXED_LINE_OR_MOBILE";
  if (!isMobile) {
    return { ok: false, reason: "not_mobile" };
  }

  return { ok: true, e164: phoneNumber.number };
}
