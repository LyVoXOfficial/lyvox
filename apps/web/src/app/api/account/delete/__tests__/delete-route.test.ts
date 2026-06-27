import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
// vi.mock calls are hoisted above imports; vi.hoisted creates variables that
// are accessible in both the mock factories and the test bodies.

const signInWithPassword = vi.hoisted(() => vi.fn());
const mockCreateClient = vi.hoisted(() =>
  vi.fn(() => ({
    auth: { signInWithPassword },
  })),
);

// Mock @supabase/supabase-js createClient (used by the route for fresh-credential re-auth).
vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

// Mock supabaseServer.
// The rate-limiter wrapper calls getUserId → supabaseServer().auth.getUser();
// the handler body calls it again; on success it calls signOut.
const mockGetUser = vi.hoisted(() => vi.fn());
const mockSignOut = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
      signOut: mockSignOut,
    },
  })),
}));

// Mock supabaseService — return a stable object so eraseAccount can be
// asserted to have been called with it.
const mockServiceClient = vi.hoisted(() => ({}));
vi.mock("@/lib/supabaseService", () => ({
  supabaseService: vi.fn(async () => mockServiceClient),
}));

// Mock eraseAccount — keep the REAL ActiveBusinessError class so `instanceof`
// works in the route. Override only `eraseAccount` with a vi.fn().
const mockEraseAccount = vi.hoisted(() => vi.fn());
vi.mock("@/lib/account/erasure", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/account/erasure")>()),
  eraseAccount: mockEraseAccount,
}));

// ─── Import route + real error class ─────────────────────────────────────────
// Import after vi.mock setup is complete. No resetModules needed because all
// dependencies are intercepted by the hoisted vi.mock factories above.
import { POST } from "../route";
import { ActiveBusinessError } from "@/lib/account/erasure";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/account/delete", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/account/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated user with email
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: "user-123", email: "alice@example.com" },
      },
    });

    // Default: signOut resolves successfully
    mockSignOut.mockResolvedValue({ error: null });

    // Default: fresh createClient's signInWithPassword succeeds
    signInWithPassword.mockResolvedValue({ data: {}, error: null });

    // Default: eraseAccount resolves (no-op)
    mockEraseAccount.mockResolvedValue(undefined);
  });

  // ── 1. No user → 401 ──────────────────────────────────────────────────────
  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(makeRequest({ confirm: "DELETE", password: "secret" }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.ok).toBe(false);
    expect(mockEraseAccount).not.toHaveBeenCalled();
  });

  // ── 2. confirm !== "DELETE" → 400 ─────────────────────────────────────────
  it("returns 400 when confirm field is missing", async () => {
    const res = await POST(makeRequest({ password: "secret" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.detail).toBe("CONFIRM_REQUIRED");
    expect(mockEraseAccount).not.toHaveBeenCalled();
  });

  it("returns 400 when confirm is wrong string", async () => {
    const res = await POST(makeRequest({ confirm: "delete", password: "secret" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.detail).toBe("CONFIRM_REQUIRED");
    expect(mockEraseAccount).not.toHaveBeenCalled();
  });

  // ── 3. Wrong password → 403 ───────────────────────────────────────────────
  it("returns 403 when signInWithPassword returns an error (wrong password)", async () => {
    signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: "Invalid login credentials" },
    });

    const res = await POST(makeRequest({ confirm: "DELETE", password: "wrongpass" }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.ok).toBe(false);
    expect(json.detail).toBe("REAUTH_FAILED");
    expect(mockEraseAccount).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("returns 400 when password field is absent for email-account", async () => {
    // No password field at all → treated as missing → 400
    const res = await POST(makeRequest({ confirm: "DELETE" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(mockEraseAccount).not.toHaveBeenCalled();
  });

  // ── 4. Happy path → 200 ───────────────────────────────────────────────────
  it("happy path: eraseAccount called once with user.id, signOut called, returns 200 { deleted: true }", async () => {
    const res = await POST(makeRequest({ confirm: "DELETE", password: "correctpass" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.deleted).toBe(true);

    expect(mockEraseAccount).toHaveBeenCalledOnce();
    expect(mockEraseAccount).toHaveBeenCalledWith(mockServiceClient, "user-123");

    expect(mockSignOut).toHaveBeenCalledOnce();
  });

  // ── 5. ActiveBusinessError → 409 ──────────────────────────────────────────
  it("returns 409 ACTIVE_BUSINESS when eraseAccount throws ActiveBusinessError; signOut NOT called", async () => {
    mockEraseAccount.mockRejectedValue(new ActiveBusinessError());

    const res = await POST(makeRequest({ confirm: "DELETE", password: "correctpass" }));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.ok).toBe(false);
    expect(json.error).toBe("ACTIVE_BUSINESS");
    expect(json.detail).toBe("ACTIVE_BUSINESS");

    // signOut must NOT be called — the account was not deleted
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  // ── 6. Unknown erasure error → 500 ────────────────────────────────────────
  it("returns 500 when eraseAccount throws an unexpected error; signOut NOT called", async () => {
    mockEraseAccount.mockRejectedValue(new Error("DB connection lost"));

    const res = await POST(makeRequest({ confirm: "DELETE", password: "correctpass" }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.ok).toBe(false);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  // ── 7. Phone-only account (no email) — confirm-only, skip re-auth ─────────
  it("skips password re-auth for phone-only account (no email) and succeeds on confirm alone", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-phone", email: null } },
    });

    // password omitted intentionally — phone-only accounts have no password
    const res = await POST(makeRequest({ confirm: "DELETE" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.deleted).toBe(true);

    // signInWithPassword must NOT be called for a phone-only user
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(mockEraseAccount).toHaveBeenCalledOnce();
    expect(mockEraseAccount).toHaveBeenCalledWith(mockServiceClient, "user-phone");
    expect(mockSignOut).toHaveBeenCalledOnce();
  });
});
