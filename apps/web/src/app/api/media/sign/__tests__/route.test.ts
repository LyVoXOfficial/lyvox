/**
 * Route-level tests for POST /api/media/sign.
 *
 * Cheap variant of the ../../list/__tests__/route.test.ts coverage, adapted
 * for the fact that sign runs body parsing + zod validation BEFORE the
 * shared auth check — so the anon/error/rate-limit requests below must
 * carry a fully valid signMediaSchema body or they'd 400 before ever
 * reaching auth.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (must be declared before the dynamic import of the route)
// ---------------------------------------------------------------------------

const getUserMock = vi.fn();
const fromMock = vi.fn();
const createSignedUploadUrlMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}));

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({
    storage: {
      from: () => ({ createSignedUploadUrl: createSignedUploadUrlMock }),
    },
  }),
}));

// Real withRateLimit wrapper stays in place — only the limiter itself is
// replaced so the 429 branch is reachable (see list/__tests__ for rationale).
const limiterMock = vi.fn(async () => ({
  success: true,
  limit: 30,
  remaining: 29,
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

const { POST } = await import("../route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADVERT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "user-1";

const VALID_BODY = {
  advertId: ADVERT_ID,
  fileName: "photo.jpg",
  contentType: "image/jpeg",
  fileSize: 1024,
};

function signReq(body: unknown = VALID_BODY) {
  return new Request("https://x.test/api/media/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Owner check passes; media count under the per-advert limit; no existing sort row. */
function makeOwnedAdvertUnderLimit() {
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
        select: (_cols: string, opts?: { count?: string; head?: boolean }) => ({
          eq: () => {
            if (opts?.count) {
              // count query used by the media-limit check
              return Promise.resolve({ count: 0, error: null });
            }
            // sort lookup (order().limit().maybeSingle())
            return {
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            };
          },
        }),
      };
    }
    throw new Error("unexpected table " + table);
  };
}

describe("POST /api/media/sign", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    createSignedUploadUrlMock.mockReset();
    limiterMock.mockClear();
    limiterMock.mockResolvedValue({
      success: true,
      limit: 30,
      remaining: 29,
      reset: 0,
      retryAfterSec: 0,
    });
  });

  it("401 UNAUTHENTICATED for anonymous requests (AuthSessionMissingError)", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthSessionMissingError", message: "Auth session missing!" },
    });

    const res = await POST(signReq());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "UNAUTHENTICATED" });
  });

  it("500 INTERNAL_ERROR when getUser returns a non-session error", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", message: "boom" },
    });

    const res = await POST(signReq());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("INTERNAL_ERROR");
  });

  it("429 RATE_LIMITED when the limiter denies the request", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    limiterMock.mockResolvedValueOnce({
      success: false,
      limit: 30,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 60,
      retryAfterSec: 60,
    });

    const res = await POST(signReq());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("RATE_LIMITED");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("200 {ok:true, data:...} happy path with mocked ownership + signed upload URL", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    fromMock.mockImplementation(makeOwnedAdvertUnderLimit());
    createSignedUploadUrlMock.mockResolvedValue({
      data: { token: "upload-token-123" },
      error: null,
    });

    const res = await POST(signReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.token).toBe("upload-token-123");
    expect(body.data.max).toBe(12);
    expect(typeof body.data.path).toBe("string");
    expect(body.data.path.startsWith(`${USER_ID}/${ADVERT_ID}/`)).toBe(true);
  });

  it("400 BAD_INPUT-shaped validation error when the body fails schema (runs before the ownership/auth check, but after rate-limit keying)", async () => {
    // withRateLimit still calls getUserId (resolveUserId) to build the rate-limit
    // key before the handler body runs, so getUser must resolve even though the
    // handler itself never reaches requireAuthenticatedUser for this request.
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const res = await POST(signReq({ advertId: "not-a-uuid" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });
});
