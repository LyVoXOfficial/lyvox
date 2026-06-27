export type TurnstileResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; codes: string[] };

/**
 * Verifies a Cloudflare Turnstile token server-side.
 *
 * Degrades gracefully when TURNSTILE_SECRET_KEY is not configured:
 * returns {ok: true, skipped: true} so dev/unconfigured registration is unaffected.
 *
 * On network or timeout error (only reachable when a secret IS configured)
 * returns {ok: false, codes: ["internal-error"]} — fail-closed.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string | null,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // No secret configured → Turnstile is a no-op.
  if (!secret) {
    return { ok: true, skipped: true };
  }

  // Secret is set but caller didn't send a token → reject.
  if (!token) {
    return { ok: false, codes: ["missing-input-response"] };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);

  try {
    const params = new URLSearchParams({ secret, response: token });
    if (ip) params.set("remoteip", ip);

    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
        signal: controller.signal,
      },
    );

    if (!res.ok) {
      return { ok: false, codes: ["internal-error"] };
    }

    const json = (await res.json()) as {
      success: boolean;
      "error-codes"?: string[];
    };

    if (json.success) {
      return { ok: true };
    }

    return { ok: false, codes: json["error-codes"] ?? [] };
  } catch {
    return { ok: false, codes: ["internal-error"] };
  } finally {
    clearTimeout(timer);
  }
}
