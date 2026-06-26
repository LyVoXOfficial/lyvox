// apps/web/src/lib/verification/nameMatch.ts
// Strip Belgian legal-form suffixes (as whole tokens) before comparing.
// Belgium has both Dutch and French equivalents for each form.

const LEGAL_FORM_TOKENS = new Set([
  "nv",    // Naamloze Vennootschap (NL)
  "sa",    // Société Anonyme (FR)
  "bv",    // Besloten Vennootschap (NL, since 2019)
  "srl",   // Société à Responsabilité Limitée (FR, since 2019)
  "bvba",  // Besloten Vennootschap met Beperkte Aansprakelijkheid (NL, legacy)
  "sprl",  // Société Privée à Responsabilité Limitée (FR, legacy)
  "cv",    // Coöperatieve Vennootschap / Société Coopérative
  "sc",    // Société Coopérative
  "commv", // Commanditaire Vennootschap (NL) — comm.v → commv after punct removal
  "scomm", // Société en Commandite (FR)
  "vzw",   // Vereniging Zonder Winstoogmerk (NL)
  "asbl",  // Association Sans But Lucratif (FR)
  "ivzw",  // Internationale Vereniging Zonder Winstoogmerk
  "aisbl", // Association Internationale Sans But Lucratif
  "se",    // Societas Europaea
  "scrl",  // Société Coopérative à Responsabilité Limitée
  "cvba",  // Coöperatieve Vennootschap met Beperkte Aansprakelijkheid (legacy)
]);

/**
 * Normalizes a legal name for comparison:
 * 1. Lowercase
 * 2. Replace punctuation with spaces (so "comm.v" → "comm v" → tokens ["comm","v"])
 * 3. Tokenize on whitespace
 * 4. Remove tokens that are recognized Belgian legal-form suffixes
 * 5. Rejoin with single space and trim
 */
export function normalizeLegalName(s: string): string {
  const lower = s.toLowerCase();
  // Replace punctuation characters (anything non-alphanumeric and non-hyphen) with a space
  // We keep hyphens because they appear in compound names like "Anheuser-Busch"
  const withSpaces = lower.replace(/[^\w\s-]/g, " ");
  const tokens = withSpaces.split(/\s+/).filter(Boolean);
  const filtered = tokens.filter((t) => !LEGAL_FORM_TOKENS.has(t));
  return filtered.join(" ").trim();
}

/**
 * Returns true when the two legal names normalize to the same string.
 * This is the "strong match" used for auto-verification (§2.3).
 */
export function legalNameMatches(a: string, b: string): boolean {
  return normalizeLegalName(a) === normalizeLegalName(b);
}
