import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { validateRequest, searchAdvertsQuerySchema } from "@/lib/validations";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";
import { executeSearch } from "@/lib/search/executeSearch";

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

  // Shared core (also used by app/search/page.tsx for the SSR first paint).
  const result = await executeSearch(validationResult.data);
  if (!result.ok) {
    return handleSupabaseError(result.supabaseError, ApiErrorCode.FETCH_FAILED);
  }

  return createSuccessResponse(result.payload);
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

