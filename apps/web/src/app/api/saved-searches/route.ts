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

const listLimiter = createRateLimiter({ limit: 60, windowSec: 60, prefix: "saved:get" });
const createLimiter = createRateLimiter({ limit: 30, windowSec: 60, prefix: "saved:post" });

const SAVED_CAP = 50;
const NEW_COUNT_SCAN = 100;
const NEW_COUNT_CONCURRENCY = 5;

// Bounded-concurrency map — caps how many search_adverts scans run at once when computing
// new_count for the list (avoids a 50-wide RPC fan-out on a busy account).
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      out[idx] = await fn(items[idx]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const filtersSchema = z.object({
  category_id: z.string().uuid().nullish(),
  price_min: z.number().nullish(),
  price_max: z.number().nullish(),
  location: z.string().max(200).nullish(),
  verified_only: z.boolean().nullish(),
  condition: z.enum(["new", "used", "for_parts"]).nullish(),
  sort_by: z.string().max(40).nullish(),
});
type SavedFilters = z.infer<typeof filtersSchema>;
const alertFrequencySchema = z.enum(["instant", "daily", "off"]);

const createSchema = z.object({
  name: z.string().min(1).max(120),
  query: z.string().max(200).nullish(),
  filters: filtersSchema.default({}),
  alert_frequency: alertFrequencySchema.default("daily"),
});

// new_count = active adverts matching the saved filters with created_at > last_seen_at.
// Reuses the existing search_adverts RPC (no RPC change); counts the newest scan window.
async function computeNewCount(
  supabase: SupabaseServerClient,
  filters: SavedFilters,
  query: string | null,
  lastSeenAt: string,
): Promise<{ count: number; capped: boolean }> {
  const { data, error } = await supabase.rpc("search_adverts", {
    search_query: query ?? undefined,
    category_id_filter: filters.category_id ?? undefined,
    price_min_filter: filters.price_min ?? undefined,
    price_max_filter: filters.price_max ?? undefined,
    location_filter: filters.location ?? undefined,
    sort_by: "created_at_desc",
    page_offset: 0,
    page_limit: NEW_COUNT_SCAN,
    verified_only: filters.verified_only ?? false,
    condition_filter: filters.condition ?? undefined,
  });
  if (error || !Array.isArray(data)) return { count: 0, capped: false };
  const since = new Date(lastSeenAt).getTime();
  const newer = (data as Array<{ created_at?: string | null }>).filter(
    (r) => r.created_at != null && new Date(r.created_at).getTime() > since,
  );
  return { count: newer.length, capped: data.length >= NEW_COUNT_SCAN };
}

async function listSaved(request: Request) {
  const { supabase, user } = await getRequestContext(request);
  if (!user) return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401, detail: "Authentication required" });

  const { data, error } = await supabase
    .from("saved_searches")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return handleSupabaseError(error, ApiErrorCode.FETCH_FAILED);

  const items = await mapWithConcurrency(data ?? [], NEW_COUNT_CONCURRENCY, async (row) => {
    const nc = await computeNewCount(supabase, (row.filters ?? {}) as SavedFilters, row.query ?? null, row.last_seen_at);
    return { ...row, new_count: nc.count, new_count_capped: nc.capped };
  });
  return createSuccessResponse({ items, total: items.length });
}

async function createSaved(request: Request) {
  const { supabase, user } = await getRequestContext(request);
  if (!user) return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401, detail: "Authentication required" });

  let body: unknown;
  try { body = await request.json(); }
  catch { return createErrorResponse(ApiErrorCode.INVALID_JSON, { status: 400, detail: "Invalid JSON body" }); }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, { status: 400, detail: parsed.error.issues[0]?.message ?? "Validation failed" });
  }

  const { count, error: countError } = await supabase
    .from("saved_searches")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (countError) return handleSupabaseError(countError, ApiErrorCode.FETCH_FAILED);
  if ((count ?? 0) >= SAVED_CAP) {
    // 409 (distinct from a 400 validation error) so the client can show the cap message specifically.
    return createErrorResponse(ApiErrorCode.BAD_INPUT, { status: 409, detail: "Saved search limit reached" });
  }

  const { data, error } = await supabase
    .from("saved_searches")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      query: parsed.data.query ?? null,
      filters: parsed.data.filters,
      alert_enabled: parsed.data.alert_frequency !== "off",
      alert_frequency: parsed.data.alert_frequency,
    })
    .select("*")
    .single();
  if (error) return handleSupabaseError(error, ApiErrorCode.INTERNAL_ERROR);
  return createSuccessResponse(data, 201);
}

export const GET = withRateLimit(listSaved, { limiter: listLimiter, getUserId: resolveUserId, makeKey: buildRateLimitKey });
export const POST = withRateLimit(withCsrfProtection(createSaved), { limiter: createLimiter, getUserId: resolveUserId, makeKey: buildRateLimitKey });
