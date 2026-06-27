// Build a Set once at module load for O(1) lookups.
// The package ships ./index.json (a plain string array of ~120k domains).
import domainList from "disposable-email-domains/index.json";

const disposableDomains: Set<string> = new Set(domainList as string[]);

/**
 * Returns true when the email's domain is on a known-disposable list.
 * Case-insensitive. Returns false for malformed input (no '@').
 */
export function isDisposableEmail(email: string): boolean {
  const lower = email.toLowerCase();
  const atIndex = lower.lastIndexOf("@");
  if (atIndex === -1) return false;
  const domain = lower.slice(atIndex + 1);
  if (!domain) return false;
  return disposableDomains.has(domain);
}
