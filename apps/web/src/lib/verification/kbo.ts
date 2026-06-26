// apps/web/src/lib/verification/kbo.ts  — pure, no network. Mirrors validate_belgian_vat() + businesses_kbo_format.
export function normalizeKbo(input: string | null | undefined): string | null {
  const d = String(input ?? "").replace(/\D/g, "");   // == public.normalize_kbo()
  return d ? d : null;
}
export function isValidKbo(input: string): boolean {
  const digits = String(input).replace(/^BE/i, "").replace(/\D/g, "");
  if (!/^[01]\d{9}$/.test(digits)) return false;        // 10 digits, leading 0/1 (DB CHECK ^[01][0-9]{9}$)
  const base = Number(digits.slice(0, 8));
  const check = Number(digits.slice(8, 10));
  return 97 - (base % 97) === check;                    // result is always 1..97
}
// Belgian VAT base == KBO number. A vat_liable trader's VAT digits must equal its KBO digits.
export function isValidBelgianVat(input: string): boolean {
  return isValidKbo(input);                              // same mod-97 on the 10-digit base
}
