import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";
import { createErrorResponse, createSuccessResponse, handleSupabaseError, ApiErrorCode } from "@/lib/apiErrors";

export const runtime = "nodejs";

type SupabaseServerClient = Awaited<ReturnType<typeof supabaseServer>>;
type SupabaseUser = Awaited<ReturnType<SupabaseServerClient["auth"]["getUser"]>>["data"]["user"];

const contextCache = new WeakMap<Request, Promise<{ supabase: SupabaseServerClient; user: SupabaseUser }>>();

const getRequestContext = async (req: Request) => {
  let cached = contextCache.get(req);
  if (!cached) {
    cached = (async () => {
      const supabase = await supabaseServer();
      const { data: { user } } = await supabase.auth.getUser();
      return { supabase, user: user ?? null };
    })();
    contextCache.set(req, cached);
  }
  return cached;
};

const resolveUserId = (req: Request) => getRequestContext(req).then(({ user }) => user?.id ?? null);

const deleteLimiter = createRateLimiter({ limit: 30, windowSec: 60, prefix: "likes:delete" });
const uuidSchema = z.string().uuid();

const buildRateLimitKey = (_req: Request, userId: string | null, ip: string | null) =>
  userId ?? ip ?? "anonymous";

async function removeLike(
  request: Request,
  context: { params: Promise<{ advertId: string }> },
) {
  const { supabase, user } = await getRequestContext(request);

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401, detail: "Authentication required" });
  }

  const { advertId } = await context.params;
  if (!uuidSchema.safeParse(advertId).success) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, { status: 400, detail: "Invalid advert ID format" });
  }

  const { error, count } = await supabase
    .from("advert_likes")
    .delete({ count: "exact" })
    .eq("user_id", user.id)
    .eq("advert_id", advertId);

  if (error) return handleSupabaseError(error, ApiErrorCode.INTERNAL_ERROR);
  if (!count) return createErrorResponse(ApiErrorCode.NOT_FOUND, { status: 404, detail: "Like not found" });
  return createSuccessResponse({ advert_id: advertId });
}

export const DELETE = withRateLimit(removeLike, {
  limiter: deleteLimiter,
  getUserId: resolveUserId,
  makeKey: buildRateLimitKey,
});
