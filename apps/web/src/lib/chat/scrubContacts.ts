/**
 * Chat anti-fraud: detect and mask off-platform contact details in messages.
 *
 * The dominant C2C scam vector is luring the counterpart OFF the platform
 * ("let's continue on WhatsApp / pay via this link / send to this IBAN"), where
 * none of the platform's protections apply. This utility masks phone numbers,
 * emails, external URLs and IBANs and reports which types were found so the
 * caller can (a) store the masked text and (b) log a risk signal.
 *
 * This is a DETERRENT + SIGNAL, not a guarantee: determined users can evade it
 * (spelled-out digits, a photo of a number, unicode look-alikes). The real
 * control that makes leaving pointless is in-platform escrow. Keep this cheap,
 * conservative (avoid false positives on prices/sizes), and observable.
 */

export const MASK = "•••";

export type ContactType = "phone" | "email" | "url" | "iban";

export type ContactScrubResult = {
  /** The message with detected contact details replaced by {@link MASK}. */
  cleaned: string;
  /** True if any contact detail was detected. */
  flagged: boolean;
  /** The distinct contact types detected, in detection order. */
  types: ContactType[];
};

// IBAN: 2 letters + 2 check digits + 10–30 alphanumerics (spaces tolerated).
// Matched first so its digits are not re-caught by the phone rule.
const IBAN_RE = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Za-z0-9]){10,30}\b/g;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s]+/gi;
// A run of digits with common separators; validated to 8–15 actual digits so we
// don't flag prices ("1500"), years ("2024") or sizes ("42"). A match is only
// treated as a PHONE NUMBER if it is phone-formatted (international prefix or
// internal separators). Bare contiguous digit strings are intentionally left
// alone: in the electronics beachhead, buyers legitimately exchange IMEIs
// (15 digits), EAN barcodes (13), and serial numbers in chat — masking those
// would break a real anti-fraud check (e.g. verifying a phone isn't stolen).
const PHONE_RE = /\+?\d[\d\s().-]{6,}\d/g;

export function scrubContacts(input: string): ContactScrubResult {
  if (!input) {
    return { cleaned: input ?? "", flagged: false, types: [] };
  }

  const types: ContactType[] = [];
  const mark = (t: ContactType) => {
    if (!types.includes(t)) types.push(t);
  };

  let out = input;
  out = out.replace(IBAN_RE, () => (mark("iban"), MASK));
  out = out.replace(EMAIL_RE, () => (mark("email"), MASK));
  out = out.replace(URL_RE, () => (mark("url"), MASK));
  out = out.replace(PHONE_RE, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return match;
    const trimmed = match.trim();
    const hasIntlPrefix = /^(?:\+|00)/.test(trimmed);
    const hasSeparator = /[\s().-]/.test(trimmed);
    // Only phone-formatted runs are masked; contiguous digit strings (IMEI/EAN/
    // serial) are preserved. Escrow — not scrubbing — is the real fraud control.
    if (hasIntlPrefix || hasSeparator) {
      mark("phone");
      return MASK;
    }
    return match;
  });

  return { cleaned: out, flagged: types.length > 0, types };
}
