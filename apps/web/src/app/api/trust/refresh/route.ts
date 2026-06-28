import "server-only";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  createSuccessResponse,
  createErrorResponse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { computeTrustScore } from "@/lib/trust/trustScore";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";

export const runtime = "nodejs";

const refreshLimiter = createRateLimiter({
  limit: 10,
  windowSec: 60 * 60,
  prefix: "trust:refresh",
});

async function handleRefresh(_req: Request): Promise<Response> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  const [profileResult, advertCountResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("verified_email, verified_phone, itsme_verified, created_at, flags")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("adverts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);

  if (profileResult.error) {
    return createErrorResponse(ApiErrorCode.FETCH_FAILED, { status: 500 });
  }

  const profile = profileResult.data;
  if (!profile) {
    return createErrorResponse(ApiErrorCode.NOT_FOUND, { status: 404 });
  }

  const flags = profile.flags as Record<string, unknown> | null;
  const activeRiskFlags = flags ? Object.values(flags).filter(Boolean).length : 0;

  const accountAgeDays = profile.created_at
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86_400_000)
    : 0;

  const components = computeTrustScore({
    verifiedEmail: profile.verified_email ?? false,
    verifiedPhone: profile.verified_phone ?? false,
    itsmeVerified: (profile as Record<string, unknown>).itsme_verified === true,
    accountAgeDays,
    activeAdverts: advertCountResult.count ?? 0,
    // F3-gated: zero until escrow is live
    completedDeals: 0,
    disputeCount: 0,
    activeRiskFlags,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- components/last_computed_at added by F14 migration, not yet in generated types
  const { error: upsertError } = await (supabase as any).from("trust_score").upsert(
    {
      user_id: user.id,
      score: components.total,
      components,
      last_computed_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (upsertError) {
    return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, { status: 500 });
  }

  return createSuccessResponse({ components });
}

export const POST = withRateLimit(handleRefresh, {
  limiter: refreshLimiter,
  getUserId: async (_req) => {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  },
  makeKey: (_req, userId, ip) => userId ?? ip ?? "anonymous",
});
