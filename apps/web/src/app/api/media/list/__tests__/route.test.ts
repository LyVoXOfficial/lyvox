/**
 * Route-level tests for GET /api/media/list.
 *
 * Focus: this route exercises the shared auth/rate-limit plumbing in
 * ../../_shared.ts (requireAuthenticatedUser, resolveUserId) that is common
 * to every media route, so these assertions pin behavior for the whole
 * media surface, not just `list`:
 *   - anon request (AuthSessionMissingError) -> 401 UNAUTHENTICATED
 *   - non-session getUser error (e.g. AuthApiError) -> 500 INTERNAL_ERROR
 *   - limiter denial -> 429 RATE_LIMITED (real withRateLimit wrapper, only
 *     the limiter function itself is swapped for a controllable mock)
 *   - happy path -> {ok:true, data:{items:[...], expiresIn}}
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (must be declared before the dynamic import of the route)
// ---------------------------------------------------------------------------

const getUserMock = vi.fn();
const fromMock = vi.fn();
const createSignedUrlMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}));

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({
    storage: {
      from: () => ({ createSignedUrl: createSignedUrlMock }),
    },
  }),
}));

// Real withRateLimit wrapper stays in place — only the limiter itself is
// replaced with a controllable mock, so the 429 branch (rate-limit denial)
// is reachable. A pass-through `withRateLimit: (h) => h` mock (as used by
// likes/phone-verify tests) would make a 429 test impossible to write.
const limiterMock = vi.fn(async () => ({
  success: true,
  limit: 60,
  remaining: 59,
  reset: 0,
  retryAfterSec: 0,
}));

vi.mock("@/lib/rateLimiter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rateLimiter")>();
  return {
    ...actual,
    createRateLimiter: () => limiterMock,
  };
});

const { GET } = await import("../route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADVERT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "user-1";

function listReq(advertId: string | null = ADVERT_ID) {
  const url = new URL("https://x.test/api/media/list");
  if (advertId) url.searchParams.set("advertId", advertId);
  return new Request(url, { method: "GET" });
}

/** Default happy-path table mock: caller owns the advert; one media row. */
function makeOwnedAdvertWithMedia() {
  return (table: string) => {
    if (table === "adverts") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: ADVERT_ID, user_id: USER_ID, status: "active" },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "media") {
      return {
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: [
                {
                  id: "media-1",
                  url: "user-1/adv-1/photo-1.jpg",
                  sort: 0,
                  w: 800,
                  h: 600,
                  created_at: "2026-01-01T00:00:00.000Z",
                },
              ],
              error: null,
            }),
          }),
        }),
      };
    }
    throw new Error("unexpected table " + table);
  };
}

describe("GET /api/media/list", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    createSignedUrlMock.mockReset();
    limiterMock.mockClear();
    limiterMock.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: 0,
      retryAfterSec: 0,
    });
  });

  it("401 UNAUTHENTICATED for anonymous requests (AuthSessionMissingError)", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthSessionMissingError", message: "Auth session missing!" },
    });

    const res = await GET(listReq());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "UNAUTHENTICATED" });
  });

  it("500 INTERNAL_ERROR when getUser returns a non-session error", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", message: "boom" },
    });

    const res = await GET(listReq());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("INTERNAL_ERROR");
  });

  it("429 RATE_LIMITED when the limiter denies the request", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    limiterMock.mockResolvedValueOnce({
      success: false,
      limit: 60,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 60,
      retryAfterSec: 60,
    });

    const res = await GET(listReq());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("RATE_LIMITED");
    // fromMock must not have been reached — the limiter short-circuits
    // before the handler runs.
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("200 {ok:true, data:...} happy path with mocked DB rows + signed URLs", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    fromMock.mockImplementation(makeOwnedAdvertWithMedia());
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: "https://signed.example/user-1/adv-1/photo-1.jpg" },
      error: null,
    });

    const res = await GET(listReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.items).toEqual([
      {
        id: "media-1",
        url: "https://signed.example/user-1/adv-1/photo-1.jpg",
        storagePath: "user-1/adv-1/photo-1.jpg",
        sort: 0,
        w: 800,
        h: 600,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(body.data.expiresIn).toBe(10 * 60);
  });

  it("400 MISSING_ADVERT_ID when advertId query param is absent (runs before the ownership/auth check, but after rate-limit keying)", async () => {
    // withRateLimit still calls getUserId (resolveUserId) to build the rate-limit
    // key before the handler body runs, so getUser must resolve even though the
    // handler itself never reaches requireAuthenticatedUser for this request.
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const res = await GET(listReq(null));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "MISSING_ADVERT_ID" });
    expect(fromMock).not.toHaveBeenCalled();
  });
});
