/**
 * GET /api/account/export
 *
 * GDPR Art.20 data-portability endpoint.
 *
 * Returns a machine-readable JSON download of all personal data the logged-in
 * user has provided to LyVoX. This pairs with the erasure route (Art.17) at
 * /api/account/delete.
 *
 * Security design:
 *  - getUser() validates the session cookie.
 *  - Data is fetched via the service-role client but every query is scoped by
 *    user.id so users never see each other's data.
 *  - Rate-limited per-user and per-IP (export is read-only but could be abused
 *    for reconnaisance or scraping if a session is hijacked).
 *  - Best-effort: if a single sub-query errors the export continues and that
 *    section is set to null. The user still gets all other sections.
 *  - Response is a raw JSON download (not the {ok,data} envelope used by API
 *    endpoints) so the browser triggers a Save dialog.
 */

import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import { createRateLimiter, withRateLimit, getClientIp } from "@/lib/rateLimiter";
import { createErrorResponse, ApiErrorCode } from "@/lib/apiErrors";

export const runtime = "nodejs";

// ── Rate limiters ─────────────────────────────────────────────────────────────
// Exports are read-only but heavier than typical reads: 10 / hour per user,
// 30 / hour per IP (shared across multiple users on the same NAT).

const exportUserLimiter = createRateLimiter({
  limit: 10,
  windowSec: 60 * 60,
  prefix: "account:export:user",
});

const exportIpLimiter = createRateLimiter({
  limit: 30,
  windowSec: 60 * 60,
  prefix: "account:export:ip",
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const getUserId = async (_req: Request): Promise<string | null> => {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
};

/**
 * Wraps a single sub-query so that errors produce null instead of
 * propagating and aborting the whole export.
 */
async function safeQuery<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[GET /api/account/export] Sub-query error for "${label}":`, err);
    return null;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

const baseHandler = async (_req: Request): Promise<Response> => {
  // ── Step 1: Verify session ────────────────────────────────────────────────
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  // ── Step 2: Gather data via service-role client ───────────────────────────
  // Every query is explicitly scoped to user.id.
  let service;
  try {
    service = await supabaseService();
  } catch (err) {
    console.error("[GET /api/account/export] Failed to get service client:", err);
    return createErrorResponse(ApiErrorCode.SERVICE_ROLE_MISSING, { status: 500 });
  }

  const uid = user.id;

  const [
    profileResult,
    phoneResult,
    listingsResult,
    messagesResult,
    purchasesResult,
    favoritesResult,
    savedSearchesResult,
    verificationsResult,
    businessResult,
  ] = await Promise.all([
    // profile — explicit columns; excludes blocked_until, rating, internal flags
    safeQuery("profile", async () => {
      const { data, error } = await service
        .from("profiles")
        .select(
          "display_name, phone, verified_email, verified_phone, seller_type, consents, created_at, notification_preferences",
        )
        .eq("id", uid)
        .maybeSingle();
      if (error) {
        console.error("[GET /api/account/export] profiles error:", error);
        return null;
      }
      return data;
    }),

    // phone
    safeQuery("phone", async () => {
      const { data, error } = await service
        .from("phones")
        .select("e164, verified")
        .eq("user_id", uid);
      if (error) {
        console.error("[GET /api/account/export] phones error:", error);
        return null;
      }
      return data ?? [];
    }),

    // listings (adverts)
    safeQuery("listings", async () => {
      const { data, error } = await service
        .from("adverts")
        .select("id, title, description, price, currency, condition, location, status, created_at")
        .eq("user_id", uid);
      if (error) {
        console.error("[GET /api/account/export] adverts error:", error);
        return null;
      }
      return data ?? [];
    }),

    // messages
    safeQuery("messages", async () => {
      const { data, error } = await service
        .from("messages")
        .select("id, conversation_id, body, created_at")
        .eq("author_id", uid);
      if (error) {
        console.error("[GET /api/account/export] messages error:", error);
        return null;
      }
      return data ?? [];
    }),

    // purchases
    safeQuery("purchases", async () => {
      const { data, error } = await service
        .from("purchases")
        .select("id, product_code, amount_cents, currency, status, created_at")
        .eq("user_id", uid);
      if (error) {
        console.error("[GET /api/account/export] purchases error:", error);
        return null;
      }
      return data ?? [];
    }),

    // favorites
    safeQuery("favorites", async () => {
      const { data, error } = await service
        .from("favorites")
        .select("advert_id, created_at")
        .eq("user_id", uid);
      if (error) {
        console.error("[GET /api/account/export] favorites error:", error);
        return null;
      }
      return data ?? [];
    }),

    // saved_searches
    safeQuery("saved_searches", async () => {
      const { data, error } = await service
        .from("saved_searches")
        .select("name, query, filters, created_at")
        .eq("user_id", uid);
      if (error) {
        console.error("[GET /api/account/export] saved_searches error:", error);
        return null;
      }
      return data ?? [];
    }),

    // verifications — method/status only, not raw evidence documents
    safeQuery("verifications", async () => {
      const { data, error } = await service
        .from("verifications")
        .select("method, status, verified_at")
        .eq("subject_type", "user")
        .eq("subject_id", uid);
      if (error) {
        console.error("[GET /api/account/export] verifications error:", error);
        return null;
      }
      return data ?? [];
    }),

    // businesses created by this user
    safeQuery("business", async () => {
      const { data, error } = await service
        .from("businesses")
        .select("legal_name, trade_name, kbo_number, vat_number, status")
        .eq("created_by", uid);
      if (error) {
        console.error("[GET /api/account/export] businesses error:", error);
        return null;
      }
      return data ?? [];
    }),
  ]);

  // ── Step 3: Build export payload ──────────────────────────────────────────
  const payload = {
    exported_at: new Date().toISOString(),
    subject: uid,
    data: {
      account: {
        id: user.id,
        email: user.email ?? null,
        created_at: user.created_at,
      },
      profile: profileResult,
      phone: phoneResult,
      listings: listingsResult,
      messages: messagesResult,
      purchases: purchasesResult,
      favorites: favoritesResult,
      saved_searches: savedSearchesResult,
      verifications: verificationsResult,
      business: businessResult,
    },
  };

  // ── Step 4: Return as file download ───────────────────────────────────────
  // Intentionally NOT the {ok,data} envelope — this is a downloadable file.
  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="lyvox-data-export-${uid}.json"`,
    },
  });
};

// ── Wrapped export with rate limiting ─────────────────────────────────────────
const withUserLimit = withRateLimit(baseHandler, {
  limiter: exportUserLimiter,
  getUserId,
  makeKey: (_req, userId) => userId,
});

export const GET = withRateLimit(withUserLimit, {
  limiter: exportIpLimiter,
  makeKey: (req) => getClientIp(req),
});
