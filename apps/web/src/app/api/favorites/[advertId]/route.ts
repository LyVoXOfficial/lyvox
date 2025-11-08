import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  createSuccessResponse,
  createErrorResponse,
  handleSupabaseError,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";

type SupabaseClient = ReturnType<typeof supabaseServer>;
type SupabaseUser = Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>["data"]["user"];

const uuidSchema = z.string().uuid();

const contextCache = new WeakMap<Request, Promise<{ supabase: SupabaseClient; user: SupabaseUser }>>();

const getRequestContext = (req: Request) => {
  let cached = contextCache.get(req);
  if (!cached) {
    const supabase = supabaseServer();
    cached = supabase.auth.getUser().then(({ data }) => ({
      supabase,
      user: data.user ?? null,
    }));
    contextCache.set(req, cached);
  }
  return cached;
};

const resolveUserId = (req: Request) => getRequestContext(req).then(({ user }) => user?.id ?? null);

const deleteLimiter = createRateLimiter({
  limit: 30,
  windowSec: 60,
  prefix: "favorites:delete",
});

const buildRateLimitKey = (_req: Request, userId: string | null, ip: string | null) =>
  userId ?? ip ?? "anonymous";

async function removeFavorite(
  request: Request,
  context: { params: Promise<{ advertId: string }> },
) {
  const { supabase, user } = await getRequestContext(request);

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, {
      status: 401,
      detail: "Authentication required",
    });
  }

  const { advertId } = await context.params;
  const uuidValidation = uuidSchema.safeParse(advertId);
  if (!uuidValidation.success) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "Invalid advert ID format",
    });
  }

  const { error: deleteError, count } = await supabase
    .from("favorites")
    .delete({ count: "exact" })
    .eq("user_id", user.id)
    .eq("advert_id", advertId);

  if (deleteError) {
    return handleSupabaseError(deleteError, ApiErrorCode.INTERNAL_ERROR);
  }

  if (!count) {
    return createErrorResponse(ApiErrorCode.NOT_FOUND, {
      status: 404,
      detail: "Favorite not found",
    });
  }

  return createSuccessResponse({
    message: "Removed from favorites",
    advert_id: advertId,
  });
}

export const DELETE = withRateLimit(removeFavorite, {
  limiter: deleteLimiter,
  getUserId: resolveUserId,
  makeKey: buildRateLimitKey,
});

