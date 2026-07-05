import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  ApiErrorCode,
} from "@/lib/apiErrors";
import type { TablesInsert } from "@/lib/supabaseTypes";
import { checkUserBlocked } from "@/lib/fraud/checkUserBlocked";
import { invokeFraudCheck } from "@/lib/fraud/invokeFraudCheck";
import { canSellAsBusiness } from "@/lib/auth/canSellAsBusiness";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";
import { validateRequest, createAdvertSchema } from "@/lib/validations";
import { withCsrfProtection } from "@/lib/security/csrf";

export const runtime = "nodejs";

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// SEC-RL1: spam surface — a compromised/scripted account can otherwise create
// unbounded draft adverts. Stacked per-user + per-IP limiters, same pattern as
// reports/create/route.ts.
const ADVERT_CREATE_USER_ATTEMPTS = parsePositiveInt(
  process.env.RATE_LIMIT_ADVERT_CREATE_USER_PER_10M,
  5,
);
const ADVERT_CREATE_USER_WINDOW_SEC = 10 * 60;
const ADVERT_CREATE_IP_ATTEMPTS = parsePositiveInt(
  process.env.RATE_LIMIT_ADVERT_CREATE_IP_PER_24H,
  50,
);
const ADVERT_CREATE_IP_WINDOW_SEC = 24 * 60 * 60;

const advertCreateUserLimiter = createRateLimiter({
  limit: ADVERT_CREATE_USER_ATTEMPTS,
  windowSec: ADVERT_CREATE_USER_WINDOW_SEC,
  prefix: "advert:create:user",
});

const advertCreateIpLimiter = createRateLimiter({
  limit: ADVERT_CREATE_IP_ATTEMPTS,
  windowSec: ADVERT_CREATE_IP_WINDOW_SEC,
  prefix: "advert:create:ip",
  bucketId: "global",
});

type SupabaseServerClient = Awaited<ReturnType<typeof supabaseServer>>;
type SupabaseUser = Awaited<ReturnType<SupabaseServerClient["auth"]["getUser"]>>["data"]["user"];
type RequestContext = { supabase: SupabaseServerClient; user: SupabaseUser };

const contextCache = new WeakMap<Request, Promise<RequestContext>>();

const getRequestContext = async (req: Request): Promise<RequestContext> => {
  let cached = contextCache.get(req);
  if (!cached) {
    cached = (async () => {
      const supabase = await supabaseServer();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return { supabase, user: user ?? null };
    })();
    contextCache.set(req, cached);
  }
  return cached;
};

const resolveUserId = (req: Request) => getRequestContext(req).then(({ user }) => user?.id ?? null);

const baseHandler = async (req: Request) => {
  const { supabase, user } = await getRequestContext(req);

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTHENTICATED, { status: 401 });
  }

  // Verification is NOT required to create a draft (Zeigarnik effect: gate at publish, not at form start).
  // Fail-closed: a draft creation counts as a high-risk mutation — we must not
  // wave a possibly-blocked user through on a transient DB error.
  const blockCheck = await checkUserBlocked(user.id, { failClosed: true });
  if (blockCheck.isBlocked) {
    return createErrorResponse(ApiErrorCode.FORBIDDEN, {
      status: 403,
      detail: blockCheck.reason || "Account is temporarily blocked",
    });
  }

  // Parse optional business_id from request body. No body at all is fine
  // (this route is usually called with no body); a malformed JSON body is
  // also treated as "no body". But if a body IS present, business_id (when
  // given) must be a valid UUID — SEC-VALID.
  let rawBody: unknown = {};
  if (req) {
    try {
      rawBody = await req.json();
    } catch {
      rawBody = {};
    }
  }
  const validation = validateRequest(createAdvertSchema, rawBody ?? {});
  if (!validation.success) {
    return validation.response;
  }
  const businessId = validation.data.business_id ?? null;

  // If posting as a business, enforce canSellAsBusiness gate
  if (businessId) {
    const check = await canSellAsBusiness(supabase, user.id, businessId);
    if (!check.ok) {
      return createErrorResponse(ApiErrorCode.VERIFICATION_REQUIRED, {
        status: 403,
        detail: check.reason,
      });
    }
  }

  const { data: defaultCategory, error: categoryError } = await supabase
    .from("categories")
    .select("id")
    .eq("level", 1)
    .eq("is_active", true)
    .order("sort", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (categoryError) {
    return handleSupabaseError(categoryError, ApiErrorCode.CATEGORY_LOOKUP_FAILED);
  }

  const categoryId = defaultCategory?.id;
  if (!categoryId) {
    return createErrorResponse(ApiErrorCode.CATEGORY_LOOKUP_FAILED, {
      status: 500,
      detail: "Active default category is not configured",
    });
  }

  const draft: TablesInsert<"adverts"> = {
    user_id: user.id,
    category_id: categoryId,
    title: "Черновик объявления",
    status: "draft",
    currency: "EUR",
    ...(businessId ? { business_id: businessId } : {}),
  };

  const service = await supabaseService();
  const { data, error } = await service
    .from("adverts")
    .insert(draft)
    .select("id, status, category_id")
    .single();

  if (error || !data) {
    return handleSupabaseError(error, ApiErrorCode.CREATE_FAILED);
  }

  // Velocity check: fire user fraud rules (advert_count, account_age_activity) so
  // bursty creation is caught in runtime and sets blocked_until for future requests.
  // Awaited with a 5-second cap inside invokeFraudCheck — does not fire-and-forget
  // because Vercel may kill the function after response if we void here.
  await invokeFraudCheck({ check_type: "user", user_id: user.id });

  return createSuccessResponse({
    advert: {
      id: data.id,
      status: data.status,
      category_id: data.category_id,
    },
  });
};

const withUserLimit = withRateLimit(baseHandler, {
  limiter: advertCreateUserLimiter,
  getUserId: resolveUserId,
  makeKey: (_req, userId) => (userId ? userId : null),
});

export const POST = withRateLimit(withCsrfProtection(withUserLimit), {
  limiter: advertCreateIpLimiter,
  makeKey: (_req, _userId, ip) => (ip ? ip : null),
});
