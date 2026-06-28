import { createHash } from "crypto";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import {
  createSuccessResponse,
  createErrorResponse,
  handleSupabaseError,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { createRateLimiter, withRateLimit, getClientIp } from "@/lib/rateLimiter";

// Runs in Node.js runtime (supabaseServer uses cookies; crypto available)
export const runtime = "nodejs";

const uuidSchema = z.string().uuid();

const viewLimiter = createRateLimiter({
  limit: 100,
  windowSec: 60,
  prefix: "adverts:view",
});

// POST /api/adverts/[id]/view — track one deduplicated advert view
async function trackView(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await supabaseServer();
  const { id: advertId } = await context.params;

  const uuidValidation = uuidSchema.safeParse(advertId);
  if (!uuidValidation.success) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "Invalid advert ID format",
    });
  }

  const { data: advert, error: advertError } = await supabase
    .from("adverts")
    .select("id, status")
    .eq("id", advertId)
    .maybeSingle();

  if (advertError) {
    return handleSupabaseError(advertError, ApiErrorCode.FETCH_FAILED);
  }

  if (!advert) {
    return createErrorResponse(ApiErrorCode.NOT_FOUND, {
      status: 404,
      detail: "Advert not found",
    });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // F8: use trusted server-side IP, not spoofable x-forwarded-for
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  // F11: compute viewer fingerprint for dedup.
  // Authenticated → 'user:<uuid>'  (stable per-account key)
  // Anonymous+IP  → 'ip:<md5>'     (MD5 for privacy — this is a dedup key, not a secret)
  // Neither       → 'unknown'      (unidentifiable; excluded from deduplicated counts)
  let viewerKey: string;
  if (user?.id) {
    viewerKey = `user:${user.id}`;
  } else if (ip) {
    viewerKey = `ip:${createHash("md5").update(ip).digest("hex")}`;
  } else {
    viewerKey = "unknown";
  }

  // 1-hour bucket: floor(unix_epoch_seconds / 3600)
  // Mirrors FLOOR(EXTRACT(EPOCH FROM viewed_at) / 3600) in the migration/function.
  const viewHour = Math.floor(Date.now() / 1000 / 3600);

  // F11: service-role insert so we bypass RLS (the open anon INSERT policy was
  // removed in migration 20260629000000_f11_advert_views_dedup.sql).
  // ON CONFLICT (advert_id, viewer_key, view_hour) DO NOTHING → dedup enforced at DB level.
  const service = await supabaseService();

  // viewer_key and view_hour are new columns not yet in generated types.
  // Remove the `as any` cast after running `pnpm gen:types`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- new columns; remove after pnpm gen:types
  const { error: insertError } = await (service.from("advert_views") as any).upsert(
    {
      advert_id: advertId,
      user_id: user?.id ?? null,
      ip_address: ip ?? null,
      user_agent: userAgent,
      viewer_key: viewerKey,
      view_hour: viewHour,
    },
    {
      onConflict: "advert_id,viewer_key,view_hour",
      ignoreDuplicates: true,
    },
  );

  if (insertError) {
    console.error("Failed to track view:", insertError);
    // Non-fatal: return success anyway — view tracking must not block page loads
    return createSuccessResponse({
      message: "View tracking failed (non-critical)",
      advert_id: advertId,
    });
  }

  const { data: viewCount, error: viewCountError } = await supabase.rpc(
    "get_advert_view_count",
    { advert_id_param: advertId },
  );

  if (viewCountError) {
    return handleSupabaseError(viewCountError, ApiErrorCode.FETCH_FAILED);
  }

  return createSuccessResponse({
    message: "View tracked",
    advert_id: advertId,
    view_count: viewCount ?? 0,
  });
}

export const POST = withRateLimit(trackView, {
  limiter: viewLimiter,
  makeKey: (_req, _userId, ip) => ip ?? "anonymous",
});
