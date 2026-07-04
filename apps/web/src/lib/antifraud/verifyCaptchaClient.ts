/**
 * Client-side helper for the generic POST /api/antifraud/verify-captcha guard.
 * Used by Supabase Auth flows that call supabase-js directly from the browser
 * (login, password-reset) and therefore have no server route of their own to
 * attach verifyTurnstile() to.
 */
export async function verifyCaptcha(token: string | null): Promise<boolean> {
  if (!token) {
    // No site key configured (dev/unconfigured) — TurnstileWidget renders
    // nothing and never produces a token; treat as a no-op pass, matching
    // verifyTurnstile()'s server-side skip behavior.
    return !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  }

  try {
    const res = await fetch("/api/antifraud/verify-captcha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const body = await res.json().catch(() => ({ ok: false }));
    return res.ok && !!body?.ok;
  } catch {
    return false;
  }
}
