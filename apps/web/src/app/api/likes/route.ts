import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";
import { withCsrfProtection } from "@/lib/security/csrf";
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
const buildRateLimitKey = (_req: Request, userId: string | null, ip: string | null) => userId ?? ip ?? "anonymous";

const likesGetLimiter = createRateLimiter({ limit: 60, windowSec: 60, prefix: "likes:get" });
const likesPostLimiter = createRateLimiter({ limit: 30, windowSec: 60, prefix: "likes:post" });

const addLikeSchema = z.object({ advert_id: z.string().uuid() });

async function getLikes(request: Request) {
  const { supabase, user } = await getRequestContext(request);
  if (!user) {
    return createSuccessResponse({ items: [], total: 0, authenticated: false });
  }
  const url = new URL(request.url);
  const limit = Math.min(Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "200", 10) || 200), 200);
  const { data, error } = await supabase
    .from("advert_likes")
    .select("advert_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return handleSupabaseError(error, ApiErrorCode.FETCH_FAILED);
  return createSuccessResponse({ items: data ?? [], total: data?.length ?? 0, authenticated: true });
}

async function addLike(request: Request) {
  const { supabase, user } = await getRequestContext(request);
  if (!user) return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401, detail: "Authentication required" });

  let body: unknown;
  try { body = await request.json(); }
  catch { return createErrorResponse(ApiErrorCode.INVALID_JSON, { status: 400, detail: "Invalid JSON body" }); }

  const parsed = addLikeSchema.safeParse(body);
  if (!parsed.success) return createErrorResponse(ApiErrorCode.BAD_INPUT, { status: 400, detail: parsed.error.issues[0]?.message ?? "Validation failed" });
  const { advert_id } = parsed.data;

  const { data: advert, error: advertError } = await supabase.from("adverts").select("id, status").eq("id", advert_id).maybeSingle();
  if (advertError || !advert) return createErrorResponse(ApiErrorCode.NOT_FOUND, { status: 404, detail: "Advert not found" });
  if (advert.status !== "active") return createErrorResponse(ApiErrorCode.BAD_INPUT, { status: 400, detail: "Cannot like inactive advert" });

  const { error: insertError } = await supabase.from("advert_likes").insert({ user_id: user.id, advert_id });
  if (insertError) {
    if (insertError.code === "23505") return createSuccessResponse({ advert_id });
    return handleSupabaseError(insertError, ApiErrorCode.INTERNAL_ERROR);
  }
  return createSuccessResponse({ advert_id }, 201);
}

export const GET = withRateLimit(getLikes, { limiter: likesGetLimiter, getUserId: resolveUserId, makeKey: buildRateLimitKey });
export const POST = withRateLimit(withCsrfProtection(addLike), { limiter: likesPostLimiter, getUserId: resolveUserId, makeKey: buildRateLimitKey });
