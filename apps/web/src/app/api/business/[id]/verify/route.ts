import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import {
  createErrorResponse,
  createSuccessResponse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { createRateLimiter, withRateLimit, getClientIp } from "@/lib/rateLimiter";
import { runViesVerification } from "@/lib/verification/runViesVerification";

export const runtime = "nodejs";

// Rate limit: 5 manual re-triggers per minute per user (VIES politeness)
const userLimiter = createRateLimiter({ limit: 5, windowSec: 60, prefix: "business:verify:user" });
const ipLimiter = createRateLimiter({ limit: 10, windowSec: 60, prefix: "business:verify:ip" });

const baseHandler = async (
  req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> => {
  const { id } = await context.params;

  // ── Auth: require business admin membership via cookie client ──────────
  const cookieClient = await supabaseServer();
  const {
    data: { user },
  } = await cookieClient.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTHENTICATED, { status: 401 });
  }

  // is_business_member is not in generated types — cast via unknown
  const { data: isAdmin } = await (
    cookieClient as unknown as {
      rpc: (
        fn: string,
        args: { b_id: string; min_role: string },
      ) => Promise<{ data: boolean | null; error: null }>;
    }
  ).rpc("is_business_member", { b_id: id, min_role: "admin" });

  if (!isAdmin) {
    return createErrorResponse(ApiErrorCode.FORBIDDEN, { status: 403 });
  }

  // ── Run verification via service-role client ────────────────────────────
  const service = await supabaseService();
  const result = await runViesVerification(service, id);

  if (result.business_status === "not_found") {
    return createErrorResponse(ApiErrorCode.BUSINESS_NOT_FOUND, { status: 404 });
  }

  return createSuccessResponse({
    method: result.method,
    status: result.status,
    entity_verified: result.entity_verified,
    business_status: result.business_status,
    evidence: result.evidence,
  });
};

// Wrap with rate limiters (per-IP outer, per-user inner)
const withUserLimit = withRateLimit<[{ params: Promise<{ id: string }> }]>(baseHandler, {
  limiter: userLimiter,
  getUserId: async (req) => {
    const cookieClient = await supabaseServer();
    const { data } = await cookieClient.auth.getUser();
    return data.user?.id ?? null;
  },
  makeKey: (_req, userId) => userId,
});

export const POST = withRateLimit<[{ params: Promise<{ id: string }> }]>(withUserLimit, {
  limiter: ipLimiter,
  makeKey: (req) => getClientIp(req),
});
