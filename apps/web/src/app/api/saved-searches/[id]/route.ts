import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";
import { withCsrfProtection } from "@/lib/security/csrf";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  ApiErrorCode,
} from "@/lib/apiErrors";
import type { TablesUpdate } from "@/lib/supabaseTypes";

export const runtime = "nodejs";

type SupabaseServerClient = Awaited<ReturnType<typeof supabaseServer>>;
type SupabaseUser = Awaited<
  ReturnType<SupabaseServerClient["auth"]["getUser"]>
>["data"]["user"];

const contextCache = new WeakMap<
  Request,
  Promise<{ supabase: SupabaseServerClient; user: SupabaseUser }>
>();
const getRequestContext = async (req: Request) => {
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
const resolveUserId = (req: Request) =>
  getRequestContext(req).then(({ user }) => user?.id ?? null);
const buildRateLimitKey = (
  _req: Request,
  userId: string | null,
  ip: string | null,
) => userId ?? ip ?? "anonymous";

const mutateLimiter = createRateLimiter({
  limit: 30,
  windowSec: 60,
  prefix: "saved:mutate",
});
const uuidSchema = z.string().uuid();
// Delivery is executed by the daily production cron. Do not expose a cadence
// that the scheduler cannot honour.
const alertFrequencySchema = z.enum(["daily", "off"]);
const patchSchema = z
  .object({
    alert_enabled: z.boolean().optional(),
    alert_frequency: alertFrequencySchema.optional(),
    seen: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.alert_enabled !== undefined ||
      d.alert_frequency !== undefined ||
      d.seen !== undefined,
    "Nothing to update",
  );

async function deleteSaved(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { supabase, user } = await getRequestContext(request);
  if (!user)
    return createErrorResponse(ApiErrorCode.UNAUTH, {
      status: 401,
      detail: "Authentication required",
    });

  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "Invalid saved search ID",
    });
  }

  const { error, count } = await supabase
    .from("saved_searches")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return handleSupabaseError(error, ApiErrorCode.INTERNAL_ERROR);
  if (!count)
    return createErrorResponse(ApiErrorCode.NOT_FOUND, {
      status: 404,
      detail: "Saved search not found",
    });
  return createSuccessResponse({ id });
}

async function patchSaved(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { supabase, user } = await getRequestContext(request);
  if (!user)
    return createErrorResponse(ApiErrorCode.UNAUTH, {
      status: 401,
      detail: "Authentication required",
    });

  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "Invalid saved search ID",
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse(ApiErrorCode.INVALID_JSON, {
      status: 400,
      detail: "Invalid JSON body",
    });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: parsed.error.issues[0]?.message ?? "Validation failed",
    });
  }

  const update: TablesUpdate<"saved_searches"> = {};
  if (parsed.data.alert_frequency !== undefined) {
    update.alert_frequency = parsed.data.alert_frequency;
    update.alert_enabled = parsed.data.alert_frequency !== "off";
  } else if (parsed.data.alert_enabled !== undefined) {
    update.alert_enabled = parsed.data.alert_enabled;
    update.alert_frequency = parsed.data.alert_enabled ? "daily" : "off";
  }
  if (parsed.data.seen === true) update.last_seen_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("saved_searches")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();
  if (error) return handleSupabaseError(error, ApiErrorCode.INTERNAL_ERROR);
  if (!data)
    return createErrorResponse(ApiErrorCode.NOT_FOUND, {
      status: 404,
      detail: "Saved search not found",
    });
  return createSuccessResponse(data);
}

export const DELETE = withRateLimit(withCsrfProtection(deleteSaved), {
  limiter: mutateLimiter,
  getUserId: resolveUserId,
  makeKey: buildRateLimitKey,
});
export const PATCH = withRateLimit(withCsrfProtection(patchSaved), {
  limiter: mutateLimiter,
  getUserId: resolveUserId,
  makeKey: buildRateLimitKey,
});
