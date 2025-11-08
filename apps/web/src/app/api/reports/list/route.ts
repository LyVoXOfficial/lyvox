import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import { hasAdminRole } from "@/lib/adminRole";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  ApiErrorCode,
} from "@/lib/apiErrors";

export const runtime = "nodejs";

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const ADMIN_ATTEMPTS = parsePositiveInt(process.env.RATE_LIMIT_ADMIN_PER_MIN, 60);
const ADMIN_WINDOW_SEC = 60;

const reportAdminLimiter = createRateLimiter({
  limit: ADMIN_ATTEMPTS,
  windowSec: ADMIN_WINDOW_SEC,
  prefix: "report:admin",
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

const baseHandler = async (request: Request) => {
  const { user } = await getRequestContext(request);

  if (!hasAdminRole(user)) {
    return createErrorResponse(ApiErrorCode.FORBIDDEN, { status: 403 });
  }

  let adminClient;
  try {
    adminClient = supabaseService();
  } catch {
    return createErrorResponse(ApiErrorCode.SERVICE_ROLE_MISSING, {
      status: 500,
      detail:
        "SUPABASE_SERVICE_ROLE_KEY is not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server to view complaints.",
    });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "pending";

  const { data, error } = await adminClient
    .from("reports")
    .select(
      `id, reason, details, status, created_at, updated_at, advert_id, reporter, reviewed_by, adverts:advert_id ( id, title, user_id )`,
    )
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) {
    return handleSupabaseError(error, ApiErrorCode.FETCH_FAILED);
  }

  return createSuccessResponse({ items: data ?? [] });
};

export const GET = withRateLimit(baseHandler, {
  limiter: reportAdminLimiter,
  getUserId: resolveUserId,
  makeKey: (_req, userId) => (userId ? userId : null),
});
