import { supabaseServer } from "@/lib/supabaseServer";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";
import {
  createErrorResponse,
  createSuccessResponse,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { validateRequest } from "@/lib/validations";
import { createReviewSchema } from "@/lib/validations/reviews";
import { trackServerEvent } from "@/lib/analytics/trackServerEvent";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

export const runtime = "nodejs";

// ── Rate limiters ─────────────────────────────────────────────────────────────
// 5 reviews per user per hour
const reviewUserLimiter = createRateLimiter({
  limit: 5,
  windowSec: 60 * 60,
  prefix: "review:user",
});

// 20 review attempts per IP per hour
const reviewIpLimiter = createRateLimiter({
  limit: 20,
  windowSec: 60 * 60,
  prefix: "review:ip",
  bucketId: "global",
});

// ── Supabase client type cast for un-typed rpc ────────────────────────────────
type CreateReviewArgs = {
  p_advert_id: string;
  p_rating: number;
  p_comment: string | null;
};

type RpcClient = {
  rpc: (
    fn: "create_review",
    args: CreateReviewArgs,
  ) => Promise<{ data: string | null; error: { message?: string } | null }>;
};

// ── Context cache (avoids double-calling supabaseServer inside withRateLimit) ──
type RequestContext = {
  supabase: Awaited<ReturnType<typeof supabaseServer>>;
  user: { id: string } | null;
};

const contextCache = new WeakMap<Request, Promise<RequestContext>>();

const getRequestContext = (req: Request): Promise<RequestContext> => {
  let cached = contextCache.get(req);
  if (!cached) {
    cached = supabaseServer().then(async (supabase) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return { supabase, user: user ?? null };
    });
    contextCache.set(req, cached);
  }
  return cached;
};

const resolveUserId = (req: Request) =>
  getRequestContext(req).then(({ user }) => user?.id ?? null);

// ── Core handler ──────────────────────────────────────────────────────────────
const baseHandler = async (req: Request): Promise<Response> => {
  const { supabase, user } = await getRequestContext(req);

  // 1. Auth guard
  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  // 2. Parse + validate body
  const parseResult = await safeJsonParse<unknown>(req);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const validationResult = validateRequest(createReviewSchema, parseResult.data);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const { advert_id, rating, comment } = validationResult.data;

  // 3. Call the RPC on the cookie client (carries auth.uid())
  const typedClient = supabase as unknown as RpcClient;
  const { data, error } = await typedClient.rpc("create_review", {
    p_advert_id: advert_id,
    p_rating: rating,
    p_comment: comment ?? null,
  });

  // 4. Map RPC raised errors by message
  if (error) {
    const msg = error.message ?? "";

    if (msg.includes("NO_CONVERSATION")) {
      return createErrorResponse(ApiErrorCode.NO_CONVERSATION, {
        status: 403,
        detail: "Contact the seller before reviewing",
      });
    }
    if (msg.includes("ALREADY_REVIEWED")) {
      return createErrorResponse(ApiErrorCode.ALREADY_REVIEWED, { status: 409 });
    }
    if (msg.includes("CANNOT_REVIEW_SELF")) {
      return createErrorResponse(ApiErrorCode.CANNOT_REVIEW_SELF, { status: 403 });
    }
    if (msg.includes("ADVERT_NOT_FOUND")) {
      return createErrorResponse(ApiErrorCode.NOT_FOUND, { status: 404 });
    }
    if (msg.includes("INVALID_RATING")) {
      return createErrorResponse(ApiErrorCode.BAD_INPUT, { status: 400 });
    }

    return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, { status: 500 });
  }

  // 5. Success — fire analytics event (best-effort, non-blocking)
  void trackServerEvent(
    ANALYTICS_EVENTS.REVIEW_CREATED,
    { advert_id, rating },
    { userId: user.id, dedupKey: `review:${advert_id}:${user.id}` },
  );

  return createSuccessResponse({ review_id: data });
};

// ── Wrap with rate limiters: per-user first, then per-IP ──────────────────────
const withUserLimit = withRateLimit(baseHandler, {
  limiter: reviewUserLimiter,
  getUserId: resolveUserId,
  makeKey: (_req, userId) => (userId ? userId : null),
});

export const POST = withRateLimit(withUserLimit, {
  limiter: reviewIpLimiter,
  makeKey: (_req, _userId, ip) => (ip ? ip : null),
});
