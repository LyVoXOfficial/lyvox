import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import { hasAdminRole } from "@/lib/adminRole";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { validateRequest } from "@/lib/validations";
import { updateReportSchema } from "@/lib/validations/reports";
import type { TablesInsert, TablesUpdate } from "@/lib/supabaseTypes";

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
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  if (!hasAdminRole(user)) {
    return createErrorResponse(ApiErrorCode.FORBIDDEN, { status: 403 });
  }

  const parseResult = await safeJsonParse<{ id?: unknown; new_status?: unknown; unpublish?: unknown }>(req);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const validationResult = validateRequest(updateReportSchema, parseResult.data);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const { id, new_status, unpublish } = validationResult.data;

  let adminClient;
  try {
    adminClient = await supabaseService();
  } catch {
    return createErrorResponse(ApiErrorCode.SERVICE_ROLE_MISSING, {
      status: 500,
      detail:
        "SUPABASE_SERVICE_ROLE_KEY is not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server to enable moderation actions.",
    });
  }

  const { data: report, error: fetchError } = await adminClient
    .from("reports")
    .select("id, advert_id, status, reporter, adverts:advert_id ( id, user_id )")
    .eq("id", id)
    .single();

  if (fetchError || !report) {
    return handleSupabaseError(fetchError, ApiErrorCode.NOT_FOUND);
  }

  const { error: updateError } = await adminClient
    .from("reports")
    .update({
      status: new_status,
      reviewed_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return handleSupabaseError(updateError, ApiErrorCode.UPDATE_FAILED);
  }

  if (new_status === "accepted" && report.adverts?.user_id) {
    const { error: trustError } = await adminClient.rpc("trust_inc", {
      uid: report.adverts.user_id,
      pts: -15,
    });
    if (trustError) {
      console.warn("TRUST_INC_FAILED", trustError.message);
    }

    if (unpublish) {
      const advertsUpdate: TablesUpdate<"adverts"> = { status: "inactive" };
      const { error: advertUpdateError } = await adminClient
        .from("adverts")
        .update(advertsUpdate)
        .eq("id", report.adverts.id);
      if (advertUpdateError) {
        console.warn("ADVERT_UNPUBLISH_FAILED", advertUpdateError.message);
      }
    }
  }

  const logEntry: TablesInsert<"logs"> = {
    user_id: user.id,
    action: "report_update",
    details: { id, new_status, unpublish: Boolean(unpublish) } as never,
  };
  await supabase.from("logs").insert(logEntry);

  return createSuccessResponse({});
};

export const POST = withRateLimit(baseHandler, {
  limiter: reportAdminLimiter,
  getUserId: resolveUserId,
  makeKey: (_req, userId) => (userId ? userId : null),
});
