/**
 * Tests for POST /api/phone/confirm-native
 *
 * Security invariants (T3):
 * - No user session → 401, no write to profiles
 * - User present but phone_confirmed_at is null → 403, no write to profiles
 * - User present, phone_confirmed_at set, but phone is NOT a Belgian mobile → 403, no write to profiles
 * - User present AND phone_confirmed_at set with a valid Belgian mobile → 200, profiles.update({verified_phone:true}) via service-role
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock setup (must be before any dynamic import of the route)
// ---------------------------------------------------------------------------

const getUserMock = vi.fn();
const getUserByIdMock = vi.fn();
const serviceFromMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({ auth: { getUser: getUserMock } }),
}));

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({
    auth: { admin: { getUserById: getUserByIdMock } },
    from: serviceFromMock,
  }),
}));

// server-only guard is a no-op in test
vi.mock("server-only", () => ({}));

const { POST } = await import("../route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = "user-uuid-t3-001";

/**
 * A chainable thenable mock that records update/eq call args.
 * `spies.update` and `spies.eq` capture what they were called with.
 */
function makeChainWithSpies(resolveWith: { data: unknown; error: unknown }) {
  const spies = {
    update: vi.fn(),
    eq: vi.fn(),
  };

  const chain: Record<string, unknown> = {};

  chain.update = (payload: unknown) => {
    spies.update(payload);
    return chain;
  };
  chain.eq = (col: unknown, val: unknown) => {
    spies.eq(col, val);
    return chain;
  };
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolveWith).then(resolve);

  return { chain, spies };
}

function makeRequest() {
  return new Request("https://x.test/api/phone/confirm-native", {
    method: "POST",
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/phone/confirm-native — security-role enforcement", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getUserByIdMock.mockReset();
    serviceFromMock.mockReset();
  });

  it("(a) 401 when no user session — no write", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UNAUTH");

    // profiles must never be touched
    expect(serviceFromMock).not.toHaveBeenCalledWith("profiles");
    expect(getUserByIdMock).not.toHaveBeenCalled();
  });

  it("(b) 403 when user exists but phone_confirmed_at is null — no profiles write", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });
    getUserByIdMock.mockResolvedValue({
      data: { user: { id: USER_ID, phone_confirmed_at: null, phone: "+32470123456" } },
      error: null,
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);

    // profiles must never be touched
    expect(serviceFromMock).not.toHaveBeenCalledWith("profiles");
  });

  it("(b-variant) 403 when admin.getUserById returns an error — no profiles write", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });
    getUserByIdMock.mockResolvedValue({
      data: { user: null },
      error: { message: "service unavailable" },
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(403);
    // profiles must never be touched
    expect(serviceFromMock).not.toHaveBeenCalledWith("profiles");
  });

  it("(c) 403 + no profiles write when phone_confirmed_at is set but phone is NOT a Belgian mobile", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });
    getUserByIdMock.mockResolvedValue({
      data: {
        user: {
          id: USER_ID,
          phone_confirmed_at: "2026-06-27T10:00:00.000Z",
          // A French mobile number — valid E.164 but not Belgian
          phone: "+33612345678",
        },
      },
      error: null,
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("PHONE_NOT_BELGIAN_MOBILE");

    // profiles must never be touched
    expect(serviceFromMock).not.toHaveBeenCalledWith("profiles");
  });

  it("(d) 200 + profiles.update({verified_phone:true}) via service-role when phone_confirmed_at is set and phone is a valid Belgian mobile", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });
    getUserByIdMock.mockResolvedValue({
      data: {
        user: {
          id: USER_ID,
          phone_confirmed_at: "2026-06-27T10:00:00.000Z",
          // A valid Belgian mobile in E.164 (as Supabase stores it)
          phone: "+32470123456",
        },
      },
      error: null,
    });

    // Set up a tracked chain for the profiles write
    const { chain, spies } = makeChainWithSpies({ data: null, error: null });
    serviceFromMock.mockReturnValue(chain);

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Must have written to profiles via service-role
    expect(serviceFromMock).toHaveBeenCalledWith("profiles");
    expect(spies.update).toHaveBeenCalledWith({ verified_phone: true });
    expect(spies.eq).toHaveBeenCalledWith("id", USER_ID);
  });
});
