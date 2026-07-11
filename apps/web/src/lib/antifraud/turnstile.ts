export type TurnstileResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; codes: string[] };

type TurnstileVerificationOptions = {
  required?: boolean;
  expectedAction?: string;
  expectedHostname?: string;
};

/**
 * Verifies a Cloudflare Turnstile token server-side.
 *
 * Degrades gracefully when TURNSTILE_SECRET_KEY is not configured:
 * returns {ok: true, skipped: true} so dev/unconfigured registration is unaffected.
 * High-risk callers can set `required` and bind the response to an expected
 * Cloudflare action and hostname; those checks fail closed.
 *
 * On network or timeout error (only reachable when a secret IS configured)
 * returns {ok: false, codes: ["internal-error"]} — fail-closed.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string | null,
  options: TurnstileVerificationOptions = {},
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // No secret configured → Turnstile is a no-op.
  if (!secret) {
    return options.required
      ? { ok: false, codes: ["missing-input-secret"] }
      : { ok: true, skipped: true };
  }

  // Secret is set but caller didn't send a token → reject.
  if (!token) {
    return { ok: false, codes: ["missing-input-response"] };
  }
  if (token.length > 2_048) {
    return { ok: false, codes: ["invalid-input-response"] };
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
      action?: string;
      hostname?: string;
    };

    if (json.success) {
      if (options.expectedAction && json.action !== options.expectedAction) {
        return { ok: false, codes: ["action-mismatch"] };
      }
      if (
        options.expectedHostname &&
        json.hostname?.toLowerCase().replace(/\.$/u, "") !==
          options.expectedHostname.toLowerCase().replace(/\.$/u, "")
      ) {
        return { ok: false, codes: ["hostname-mismatch"] };
      }
      return { ok: true };
    }

    return { ok: false, codes: json["error-codes"] ?? [] };
  } catch {
    return { ok: false, codes: ["internal-error"] };
  } finally {
    clearTimeout(timer);
  }
}
