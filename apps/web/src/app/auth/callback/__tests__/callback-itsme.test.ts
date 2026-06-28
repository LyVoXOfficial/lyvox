import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — declared BEFORE dynamic import of the route
// ---------------------------------------------------------------------------

const exchangeCodeForSessionMock = vi.fn();
const fromServiceMock = vi.fn();
const adminSignOutMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      exchangeCodeForSession: exchangeCodeForSessionMock,
    },
  }),
}));

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({
    from: fromServiceMock,
    auth: {
      admin: {
        signOut: adminSignOutMock,
      },
    },
  }),
}));

vi.mock("@/lib/errorLogger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}));

const { GET } = await import("../route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCallbackReq(code = "valid-code"): Request {
  return new Request(`https://www.lyvox.be/auth/callback?code=${code}`, {
    headers: { cookie: "" },
  });
}

function makeItsmeUser(overrides: {
  id?: string;
  sub?: string;
  subInIdentities?: boolean;
  kycLevel?: string;
} = {}) {
  const {
    id = "user-itsme-1",
    sub = "itsme-sub-abc123",
    subInIdentities = true,
    kycLevel = "extended",
  } = overrides;

  return {
    id,
    email: "user@example.com",
    app_metadata: { provider: "itsme", kyc_level: kycLevel },
    user_metadata: { kyc_level: kycLevel, sub: subInIdentities ? undefined : sub },
    identities: subInIdentities
      ? [{ provider: "itsme", id: sub, identity_data: { sub } }]
      : [],
  };
}

function makeProfilesUpdateChain(error: { code: string; message: string } | null = null) {
  return {
    update: (_data: unknown) => ({
      eq: (_col: string, _val: unknown) =>
        Promise.resolve({ error }),
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /auth/callback — F10 itsme_sub uniqueness", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminSignOutMock.mockResolvedValue({ error: null });
  });

  // ── Normal itsme login: sub written from identities array ─────────────────
  it("(a) writes itsme_sub from identities[].id on successful itsme login", async () => {
    const user = makeItsmeUser({ sub: "sub-abc", subInIdentities: true });
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { session: { user }, user },
      error: null,
    });

    const updateSpy = vi.fn().mockReturnValue({
      eq: () => Promise.resolve({ error: null }),
    });
    fromServiceMock.mockImplementation((table: string) => {
      if (table === "profiles") return { update: updateSpy };
      throw new Error("Unexpected table: " + table);
    });

    const res = await GET(makeCallbackReq() as unknown as import("next/server").NextRequest);

    expect(res.status).toBe(307);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        itsme_verified: true,
        itsme_sub: "sub-abc",
      })
    );
    expect(adminSignOutMock).not.toHaveBeenCalled();
  });

  // ── Sub in user_metadata fallback ─────────────────────────────────────────
  it("(b) falls back to user_metadata.sub when identities is empty", async () => {
    const user = makeItsmeUser({ sub: "sub-from-meta", subInIdentities: false });
    // identities is [] but user_metadata.sub is set
    user.user_metadata.sub = "sub-from-meta";
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { session: { user }, user },
      error: null,
    });

    const updateSpy = vi.fn().mockReturnValue({
      eq: () => Promise.resolve({ error: null }),
    });
    fromServiceMock.mockImplementation((table: string) => {
      if (table === "profiles") return { update: updateSpy };
      throw new Error("Unexpected table: " + table);
    });

    await GET(makeCallbackReq() as unknown as import("next/server").NextRequest);

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ itsme_sub: "sub-from-meta" })
    );
  });

  // ── F10: Collision → sign out + redirect to error ─────────────────────────
  it("(c) hard-rejects itsme_sub collision: calls admin.signOut and redirects to login with identity_conflict", async () => {
    const user = makeItsmeUser({ sub: "sub-collision" });
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { session: { user }, user },
      error: null,
    });

    // Simulate unique constraint violation on profiles_itsme_sub_key
    const collisionError = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "profiles_itsme_sub_key"',
    };
    fromServiceMock.mockImplementation((table: string) => {
      if (table === "profiles") return makeProfilesUpdateChain(collisionError);
      throw new Error("Unexpected table: " + table);
    });

    const res = await GET(makeCallbackReq() as unknown as import("next/server").NextRequest);

    // Must sign out the attacker's session
    expect(adminSignOutMock).toHaveBeenCalledWith(user.id, "global");

    // Must redirect to /login with error=identity_conflict
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/login");
    expect(location).toContain("error=identity_conflict");
  });

  // ── F10: Collision on 'itsme_sub' substring in message ───────────────────
  it("(d) also detects collision when message contains 'itsme_sub' (pg error variants)", async () => {
    const user = makeItsmeUser({ sub: "sub-variant" });
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { session: { user }, user },
      error: null,
    });

    const collisionError = {
      code: "23505",
      message: "unique_violation on itsme_sub column",
    };
    fromServiceMock.mockImplementation((table: string) => {
      if (table === "profiles") return makeProfilesUpdateChain(collisionError);
      throw new Error("Unexpected table: " + table);
    });

    const res = await GET(makeCallbackReq() as unknown as import("next/server").NextRequest);

    expect(adminSignOutMock).toHaveBeenCalledWith(user.id, "global");
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("identity_conflict");
  });

  // ── Non-collision profile error: continues (does NOT sign out) ────────────
  it("(e) non-unique-violation profile error logs but does NOT sign out or redirect to error", async () => {
    const user = makeItsmeUser({ sub: "sub-generic-error" });
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { session: { user }, user },
      error: null,
    });

    const genericError = { code: "500", message: "db connection failed" };
    fromServiceMock.mockImplementation((table: string) => {
      if (table === "profiles") return makeProfilesUpdateChain(genericError);
      throw new Error("Unexpected table: " + table);
    });

    const res = await GET(makeCallbackReq() as unknown as import("next/server").NextRequest);

    expect(adminSignOutMock).not.toHaveBeenCalled();
    // Should still redirect to /profile (normal success path)
    const location = res.headers.get("location") ?? "";
    expect(location).not.toContain("identity_conflict");
    expect(location).toContain("/profile");
  });

  // ── Non-itsme provider: itsme block is skipped entirely ──────────────────
  it("(f) non-itsme provider skips itsme update block entirely", async () => {
    const emailUser = {
      id: "user-email-1",
      email: "user@example.com",
      app_metadata: { provider: "email" },
      user_metadata: {},
      identities: [],
    };
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { session: { user: emailUser }, user: emailUser },
      error: null,
    });

    fromServiceMock.mockImplementation(() => {
      throw new Error("supabaseService should not be called for non-itsme provider");
    });

    const res = await GET(makeCallbackReq() as unknown as import("next/server").NextRequest);

    expect(res.status).toBe(307);
    expect(adminSignOutMock).not.toHaveBeenCalled();
  });

  // ── Missing code → redirect to /login ────────────────────────────────────
  it("(g) missing code param redirects to /login with missing_code error", async () => {
    const req = new Request("https://www.lyvox.be/auth/callback");
    const res = await GET(req as unknown as import("next/server").NextRequest);

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/login");
    expect(location).toContain("missing_code");
  });
});
