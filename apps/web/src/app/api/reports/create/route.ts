import { supabaseServer } from "@/lib/supabaseServer";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";

export const runtime = "nodejs";

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const REPORT_USER_ATTEMPTS = parsePositiveInt(process.env.RATE_LIMIT_REPORT_USER_PER_10M, 5);
const REPORT_USER_WINDOW_SEC = 10 * 60;
const REPORT_IP_ATTEMPTS = parsePositiveInt(process.env.RATE_LIMIT_REPORT_IP_PER_24H, 50);
const REPORT_IP_WINDOW_SEC = 24 * 60 * 60;

const reportUserLimiter = createRateLimiter({
  limit: REPORT_USER_ATTEMPTS,
  windowSec: REPORT_USER_WINDOW_SEC,
  prefix: "report:user",
});

const reportIpLimiter = createRateLimiter({
  limit: REPORT_IP_ATTEMPTS,
  windowSec: REPORT_IP_WINDOW_SEC,
  prefix: "report:ip",
  bucketId: "global",
});

type SupabaseClient = ReturnType<typeof supabaseServer>;
type SupabaseUser = Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>["data"]["user"];
type RequestContext = { supabase: SupabaseClient; user: SupabaseUser };

const contextCache = new WeakMap<Request, Promise<RequestContext>>();

const getRequestContext = (req: Request): Promise<RequestContext> => {
  let cached = contextCache.get(req);
  if (!cached) {
    const supabase = supabaseServer();
    cached = supabase.auth.getUser().then(({ data }) => ({ supabase, user: data.user ?? null }));
    contextCache.set(req, cached);
  }
  return cached;
};

const resolveUserId = (req: Request) => getRequestContext(req).then(({ user }) => user?.id ?? null);

const baseHandler = async (req: Request) => {
  const { supabase, user } = await getRequestContext(req);

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  const parseResult = await safeJsonParse<{ advert_id?: unknown; reason?: unknown; details?: unknown }>(req);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const { advert_id, reason, details } = parseResult.data;

  if (!advert_id || typeof advert_id !== "string" || !reason || typeof reason !== "string") {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, { status: 400 });
  }

  const { data: exists } = await supabase
    .from("reports")
    .select("id")
    .eq("advert_id", advert_id)
    .eq("reporter", user.id)
    .eq("status", "pending")
    .limit(1);

  if (exists && exists.length) {
    return createErrorResponse(ApiErrorCode.ALREADY_REPORTED, { status: 409 });
  }

  const { error } = await supabase.from("reports").insert({
    advert_id,
    reporter: user.id,
    reason,
    details: details ?? null,
  } as never);

  if (error) {
    return handleSupabaseError(error, ApiErrorCode.CREATE_FAILED);
  }

  await supabase.from("logs").insert({
    user_id: user.id,
    action: "report_create",
    details: { advert_id, reason } as never,
  });

  return createSuccessResponse({});
};

const withUserLimit = withRateLimit(baseHandler, {
  limiter: reportUserLimiter,
  getUserId: resolveUserId,
  makeKey: (_req, userId) => (userId ? userId : null),
});

export const POST = withRateLimit(withUserLimit, {
  limiter: reportIpLimiter,
  makeKey: (_req, _userId, ip) => (ip ? ip : null),
});
