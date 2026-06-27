import { supabaseServer } from "@/lib/supabaseServer";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { validateRequest, searchAdvertsQuerySchema } from "@/lib/validations";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";
import { resolveFirstImages } from "@/lib/advertMedia";
import { resolveLikeCounts } from "@/lib/likeCounts";

export const runtime = "nodejs";

// Rate limiting configuration for search endpoint
// Public endpoint with higher limits than sensitive endpoints
const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const SEARCH_IP_ATTEMPTS = parsePositiveInt(process.env.RATE_LIMIT_SEARCH_IP_PER_MIN, 60);
const SEARCH_IP_WINDOW_SEC = 60;

const searchIpLimiter = createRateLimiter({
  limit: SEARCH_IP_ATTEMPTS,
  windowSec: SEARCH_IP_WINDOW_SEC,
  prefix: "search:ip",
});

// Instant/typeahead search (SearchBar fires /api/search on each debounced keystroke) gets
// its own, higher-limit bucket so a fast typer can't drain the main bucket and then have
// their real search submission rate-limited. SearchBar tags those requests with ?instant=1.
const SEARCH_INSTANT_IP_ATTEMPTS = parsePositiveInt(
  process.env.RATE_LIMIT_SEARCH_INSTANT_IP_PER_MIN,
  240,
);

const searchInstantIpLimiter = createRateLimiter({
  limit: SEARCH_INSTANT_IP_ATTEMPTS,
  windowSec: SEARCH_IP_WINDOW_SEC,
  prefix: "search:instant:ip",
});

const INSTANT_KEY_PREFIX = "instant:";

// withRateLimit takes a single limiter; dispatch to the instant bucket when makeKey tagged
// the key, then strip the marker so each bucket keys on the bare IP.
const searchLimiterDispatch = (key: string) =>
  key.startsWith(INSTANT_KEY_PREFIX)
    ? searchInstantIpLimiter(key.slice(INSTANT_KEY_PREFIX.length))
    : searchIpLimiter(key);

const isInstantRequest = (request: Request) => {
  const flag = new URL(request.url).searchParams.get("instant");
  return flag === "1" || flag === "true";
};

// Card fields projected out of the full search_adverts RPC row before responding.
type SearchRpcRow = {
  id: string;
  user_id?: string | null;
  category_id?: string | null;
  title: string;
  price?: number | null;
  currency?: string | null;
  location?: string | null;
  created_at?: string | null;
  seller_verified?: boolean | null;
};

/**
 * GET /api/search
 * 
 * Search adverts with full-text search, filters, sorting, and pagination.
 * 
 * Query parameters:
 * - q: Search query text (full-text search in title and description)
 * - category_id: Filter by category UUID
 * - price_min: Minimum price filter
 * - price_max: Maximum price filter
 * - location: Text matching for location
 * - lat: Latitude for geospatial search (requires lng)
 * - lng: Longitude for geospatial search (requires lat)
 * - radius_km: Search radius in kilometers (default: 50, max: 1000)
 * - sort_by: Sort option (relevance, price_asc, price_desc, created_at_asc, created_at_desc)
 * - page: Page number for pagination (default: 0)
 * - limit: Results per page (default: 24, max: 100)
 * 
 * Returns: Array of adverts with total_count and relevance_rank
 */
const baseHandler = async (request: Request) => {
  // Parse query parameters from URL
  const url = new URL(request.url);
  const queryParams: Record<string, string | undefined> = {};
  
  // Extract all query parameters
  for (const [key, value] of url.searchParams.entries()) {
    queryParams[key] = value;
  }

  // Validate query parameters with Zod schema
  const validationResult = validateRequest(searchAdvertsQuerySchema, queryParams);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const params = validationResult.data;

  // Calculate pagination offset
  const pageOffset = params.page * params.limit;

  // Prepare parameters for PostgreSQL function
  const searchParams = {
    search_query: params.q ?? undefined,
    category_id_filter: params.category_id ?? undefined,
    price_min_filter: params.price_min ?? undefined,
    price_max_filter: params.price_max ?? undefined,
    location_filter: params.location ?? undefined,
    location_lat: params.lat ?? undefined,
    location_lng: params.lng ?? undefined,
    radius_km: params.radius_km ?? 50,
    sort_by: params.sort_by ?? undefined,
    page_offset: pageOffset,
    page_limit: params.limit,
    verified_only: params.verified_only ?? false,
    condition_filter: params.condition ?? undefined,
  };

  const supabase = await supabaseServer();

  // Call PostgreSQL function search_adverts via RPC
  const { data, error } = await supabase.rpc("search_adverts", searchParams);

  if (error) {
    return handleSupabaseError(error, ApiErrorCode.FETCH_FAILED);
  }

  // Extract total_count from first result (if available) or calculate from array length
  const totalCount = data && data.length > 0 ? (data[0]?.total_count ?? data.length) : 0;

  // Project each RPC row to the card fields the clients actually render. The RPC returns
  // the full advert row (description, condition, status, location_id, updated_at,
  // relevance_rank, total_count, …) but shipping all of it bloats the payload (24 full
  // descriptions per page) and leaks more shape than intended. user_id + category_id are
  // kept on purpose: the discover swipe deck (mapSearchItemToDeckCard) needs sellerId
  // (= chat peer_id) and categoryId for taste reranking and the actions sheet.
  const results =
    (data as SearchRpcRow[] | null)?.map((row) => ({
      id: row.id,
      user_id: row.user_id ?? null,
      category_id: row.category_id ?? null,
      title: row.title,
      price: row.price ?? null,
      currency: row.currency ?? null,
      location: row.location ?? null,
      created_at: row.created_at ?? null,
      seller_verified: Boolean(row.seller_verified),
    })) ?? [];

  const ids = results.map((r) => r.id);
  const [imageMap, likeMap] = await Promise.all([
    resolveFirstImages(ids, { cap: params.limit }),
    resolveLikeCounts(ids, { cap: params.limit }),
  ]);
  const itemsWithImages = results.map((r) => ({
    ...r,
    image: imageMap.get(r.id) ?? null,
    like_count: likeMap.get(r.id) ?? 0,
  }));

  return createSuccessResponse({
    items: itemsWithImages,
    total: totalCount,
    page: params.page,
    limit: params.limit,
    hasMore: totalCount > pageOffset + results.length,
  });
};

// Apply rate limiting by IP address. Instant/typeahead requests (?instant=1) are routed
// to a separate, higher-limit bucket via the key marker.
export const GET = withRateLimit(baseHandler, {
  limiter: searchLimiterDispatch,
  makeKey: (req, _userId, ip) => {
    const base = ip ?? "anonymous";
    return isInstantRequest(req) ? `${INSTANT_KEY_PREFIX}${base}` : base;
  },
});

