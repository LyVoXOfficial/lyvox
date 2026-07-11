const DEFAULT_MAX_RETURN_TO_LENGTH = 2_048;
const INTERNAL_URL_BASE = "https://internal.invalid";

/**
 * Accept only a path on this origin. This value is safe to pass to a router or
 * `new URL(path, trustedOrigin)` after OAuth/password authentication.
 */
export function sanitizeInternalReturnTo(
  value: unknown,
  fallback = "/",
  maxLength = DEFAULT_MAX_RETURN_TO_LENGTH,
): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    return fallback;
  }

  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/u.test(value) ||
    /^\/(?:%2f|%5c)/iu.test(value)
  ) {
    return fallback;
  }

  try {
    const resolved = new URL(value, INTERNAL_URL_BASE);
    if (resolved.origin !== INTERNAL_URL_BASE) return fallback;
    const normalized = `${resolved.pathname}${resolved.search}${resolved.hash}`;
    // URL normalization can collapse dot segments into a protocol-relative
    // looking pathname (for example `/foo/..//evil.test`). Re-validate the
    // normalized result before any caller passes it to `new URL()` or a router.
    if (
      !normalized.startsWith("/") ||
      normalized.startsWith("//") ||
      normalized.includes("\\") ||
      /^\/(?:%2f|%5c)/iu.test(normalized)
    ) {
      return fallback;
    }
    return normalized;
  } catch {
    return fallback;
  }
}
