/**
 * POST /api/account/delete
 *
 * GDPR Art.17 account self-erasure endpoint.
 *
 * Security design:
 *  - getUser() validates the session cookie first.
 *  - Body requires { confirm: "DELETE", password: string }.
 *  - Re-authentication: a FRESH supabase client (no cookie session) verifies the
 *    caller's password via signInWithPassword. This defends against a hijacked-but-
 *    not-yet-authenticated session triggering an irreversible self-deletion. The fresh
 *    client uses persistSession:false / autoRefreshToken:false so it never touches the
 *    user's active session.
 *  - Phone-only accounts (user.email is null/empty): some users signed up via OTP SMS
 *    only and have no password. For these accounts the password re-auth step is SKIPPED;
 *    confirm:"DELETE" alone is accepted. This is documented and intentional — their
 *    threat model differs (phone + OTP controls access, not a password). A future
 *    improvement may require OTP re-auth for this path.
 *  - Rate-limited per-user and per-IP (deletion attempts are very low-volume in normal
 *    use; aggressive limiting protects against account-takeover-then-delete attacks).
 *  - eraseAccount() performs the actual GDPR erasure; on ActiveBusinessError the route
 *    returns 409 so the user is guided to close/transfer their business first.
 *  - On success, the server-side cookie session is signed out (the auth.users row is
 *    already gone; sign-out clears the cookie so the browser gets redirected on next
 *    load rather than receiving a confusing 401 loop).
 */

import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import { createRateLimiter, withRateLimit, getClientIp } from "@/lib/rateLimiter";
import {
  createErrorResponse,
  createSuccessResponse,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { eraseAccount, ActiveBusinessError } from "@/lib/account/erasure";
import { deleteAccountSchema } from "@/lib/validations";
import { withCsrfProtection } from "@/lib/security/csrf";

export const runtime = "nodejs";

// ── Rate limiters ─────────────────────────────────────────────────────────────
// Conservative limits — a legitimate user deletes their account at most once.

const deletionUserLimiter = createRateLimiter({
  limit: 5,
  windowSec: 60 * 60, // 5 attempts / hour per user
  prefix: "account:delete:user",
});

const deletionIpLimiter = createRateLimiter({
  limit: 10,
  windowSec: 60 * 60, // 10 attempts / hour per IP
  prefix: "account:delete:ip",
});

// ── Route handler ─────────────────────────────────────────────────────────────

const getUserId = async (_req: Request): Promise<string | null> => {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
};

const baseHandler = async (req: Request): Promise<Response> => {
  // ── Step 1: Verify session ────────────────────────────────────────────────
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  // ── Step 2: Parse body ────────────────────────────────────────────────────
  const parseResult = await safeJsonParse<unknown>(req);
  if (!parseResult.success) {
    return parseResult.response;
  }

  // Schema enforces confirm === "DELETE" and password (when present) is a
  // non-empty string. We deliberately use safeParse (not validateRequest)
  // here so a validation failure keeps the pre-existing, documented
  // "CONFIRM_REQUIRED" detail contract instead of a raw zod message.
  const validation = deleteAccountSchema.safeParse(parseResult.data);
  if (!validation.success) {
    return createErrorResponse(ApiErrorCode.INVALID_PAYLOAD, {
      status: 400,
      detail: "CONFIRM_REQUIRED",
    });
  }

  const { password } = validation.data;

  // ── Step 3: Re-authenticate (fresh credential confirmation) ───────────────
  // Phone-only accounts have no password (email is null/empty). For those, we
  // skip re-auth and rely solely on the confirm:"DELETE" phrase + the valid
  // session cookie. See module-level JSDoc for rationale.
  const hasEmail = typeof user.email === "string" && user.email.length > 0;

  if (hasEmail) {
    if (typeof password !== "string" || password.length === 0) {
      return createErrorResponse(ApiErrorCode.INVALID_PAYLOAD, {
        status: 400,
        detail: "CONFIRM_REQUIRED",
      });
    }

    // Fresh anon client — does NOT touch the user's cookie session.
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { error: signInError } = await anonClient.auth.signInWithPassword({
      email: user.email!,
      password,
    });

    if (signInError) {
      return createErrorResponse(ApiErrorCode.REAUTH_FAILED, {
        status: 403,
        detail: "REAUTH_FAILED",
      });
    }
  }

  // ── Step 4: Erase account ─────────────────────────────────────────────────
  const service = await supabaseService();

  try {
    await eraseAccount(service, user.id);
  } catch (err) {
    if (err instanceof ActiveBusinessError) {
      return createErrorResponse(ApiErrorCode.ACTIVE_BUSINESS, {
        status: 409,
        detail: "ACTIVE_BUSINESS",
      });
    }
    console.error("[DELETE /api/account/delete] Unexpected erasure error:", err);
    return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, { status: 500 });
  }

  // ── Step 5: Sign out (clear cookie — auth identity already deleted) ───────
  // Defensive: don't let a signOut error mask a successful deletion; the erase
  // already committed and is irreversible.
  try {
    await supabase.auth.signOut();
  } catch (signOutErr) {
    console.error("[DELETE /api/account/delete] signOut failed (non-fatal):", signOutErr);
  }

  return createSuccessResponse({ deleted: true });
};

// ── Wrapped export with rate limiting ─────────────────────────────────────────
const withUserLimit = withRateLimit(baseHandler, {
  limiter: deletionUserLimiter,
  getUserId,
  makeKey: (_req, userId) => userId,
});

export const POST = withRateLimit(withCsrfProtection(withUserLimit), {
  limiter: deletionIpLimiter,
  makeKey: (req) => getClientIp(req),
});
