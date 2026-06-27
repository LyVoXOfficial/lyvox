import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
// vi.mock calls are hoisted above imports; vi.hoisted creates variables that
// are accessible in both the mock factories and the test bodies.

const mockGetUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

// ── Supabase service mock ─────────────────────────────────────────────────────
// We need per-table query builders. Each .from(table) returns a builder whose
// .select().eq()... chain resolves to { data, error }.
// We model this with a map of table -> mockResolvedValue factories.

type QueryResult = { data: unknown; error: unknown };

const mockFromTable = vi.hoisted(
  () =>
    new Map<
      string,
      () => Promise<QueryResult>
    >(),
);

// Fluent query-builder factory: each method returns `this` until the terminal
// `.eq()` / `.maybeSingle()` etc., which return the mock for that table.
const makeBuilder = (tableName: string) => {
  const resolver = () =>
    mockFromTable.get(tableName)?.() ?? Promise.resolve({ data: [], error: null });

  const builder: Record<string, unknown> = {};

  // All chainable methods return the same builder
  const chainable = ["select", "eq", "order", "in", "limit", "not", "is"];
  for (const method of chainable) {
    builder[method] = (..._args: unknown[]) => builder;
  }

  // Terminal methods
  builder["maybeSingle"] = () => resolver();
  builder["single"] = () => resolver();
  // When the chain ends without a terminal (e.g. just .select().eq()) vitest
  // needs the Promise. We make the builder itself thenable:
  builder["then"] = (resolve: (v: QueryResult) => unknown, reject: (e: unknown) => unknown) =>
    resolver().then(resolve, reject);

  return builder;
};

const mockServiceClient = vi.hoisted(() => ({
  from: vi.fn((table: string) => makeBuilder(table)),
}));

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: vi.fn(async () => mockServiceClient),
}));

// ─── Import route after mocks ─────────────────────────────────────────────────
import { GET } from "../route";

// ─── Constants ────────────────────────────────────────────────────────────────
const USER_ID = "user-abc-123";
const USER_EMAIL = "alice@example.com";
const USER_CREATED_AT = "2024-01-15T10:00:00.000Z";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/account/export", {
    method: "GET",
    headers: { ...headers },
  });
}

/** Sets up a successful mock for all tables */
function setupHappyPath() {
  mockFromTable.set("profiles", () =>
    Promise.resolve({
      data: {
        display_name: "Alice",
        phone: null,
        verified_email: true,
        verified_phone: false,
        seller_type: "private",
        consents: null,
        created_at: USER_CREATED_AT,
        notification_preferences: null,
      },
      error: null,
    }),
  );

  mockFromTable.set("phones", () =>
    Promise.resolve({ data: [{ e164: "+32471000001", verified: true }], error: null }),
  );

  mockFromTable.set("adverts", () =>
    Promise.resolve({
      data: [
        {
          id: "adv-1",
          title: "Test car",
          description: "Nice car",
          price: 5000,
          currency: "EUR",
          condition: "good",
          location: "Brussels",
          status: "active",
          created_at: USER_CREATED_AT,
        },
      ],
      error: null,
    }),
  );

  mockFromTable.set("messages", () =>
    Promise.resolve({
      data: [
        {
          id: "msg-1",
          conversation_id: "conv-1",
          body: "Hello",
          created_at: USER_CREATED_AT,
        },
      ],
      error: null,
    }),
  );

  mockFromTable.set("purchases", () =>
    Promise.resolve({ data: [], error: null }),
  );

  mockFromTable.set("favorites", () =>
    Promise.resolve({
      data: [{ advert_id: "adv-2", created_at: USER_CREATED_AT }],
      error: null,
    }),
  );

  mockFromTable.set("saved_searches", () =>
    Promise.resolve({ data: [], error: null }),
  );

  mockFromTable.set("verifications", () =>
    Promise.resolve({ data: [], error: null }),
  );

  mockFromTable.set("businesses", () =>
    Promise.resolve({ data: [], error: null }),
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/account/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFromTable.clear();
    mockServiceClient.from.mockImplementation((table: string) => makeBuilder(table));

    // Default: authenticated user
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: USER_ID, email: USER_EMAIL, created_at: USER_CREATED_AT },
      },
    });
  });

  // ── 1. No user → 401 ──────────────────────────────────────────────────────
  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.ok).toBe(false);
    // Service client must NOT be called
    expect(mockServiceClient.from).not.toHaveBeenCalled();
  });

  // ── 2. Happy path → 200 download ─────────────────────────────────────────
  it("happy path: returns 200 with Content-Disposition attachment and all sections", async () => {
    setupHappyPath();

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    // Must be a file download, not the API envelope
    const cd = res.headers.get("Content-Disposition");
    expect(cd).toMatch(/attachment/);
    expect(cd).toMatch(`lyvox-data-export-${USER_ID}.json`);

    const ct = res.headers.get("Content-Type");
    expect(ct).toMatch("application/json");

    const body = await res.json();

    // Top-level shape
    expect(body).toHaveProperty("exported_at");
    expect(body.subject).toBe(USER_ID);
    expect(body).toHaveProperty("data");

    // All required sections present
    const d = body.data;
    expect(d).toHaveProperty("account");
    expect(d).toHaveProperty("profile");
    expect(d).toHaveProperty("phone");
    expect(d).toHaveProperty("listings");
    expect(d).toHaveProperty("messages");
    expect(d).toHaveProperty("purchases");
    expect(d).toHaveProperty("favorites");
    expect(d).toHaveProperty("saved_searches");
    expect(d).toHaveProperty("verifications");
    expect(d).toHaveProperty("business");

    // Account section comes from auth user
    expect(d.account.id).toBe(USER_ID);
    expect(d.account.email).toBe(USER_EMAIL);

    // Profile section is present (not null from mock)
    expect(d.profile).not.toBeNull();
    expect(d.profile.display_name).toBe("Alice");

    // Listings returned
    expect(Array.isArray(d.listings)).toBe(true);
    expect(d.listings).toHaveLength(1);
    expect(d.listings[0].id).toBe("adv-1");

    // Messages returned
    expect(Array.isArray(d.messages)).toBe(true);
    expect(d.messages[0].id).toBe("msg-1");
  });

  // ── 3. Queries are scoped by user.id ─────────────────────────────────────
  it("scopes every sub-query to the authenticated user id", async () => {
    setupHappyPath();

    // Spy on the individual builders to verify .eq() is called with user id
    const eqCalls: Array<[string, string, string]> = [];
    mockServiceClient.from.mockImplementation((table: string) => {
      const builder = makeBuilder(table);
      // Wrap the eq() method to record calls
      const originalEq = builder["eq"] as (...args: unknown[]) => typeof builder;
      builder["eq"] = (col: unknown, val: unknown) => {
        eqCalls.push([table, String(col), String(val)]);
        return originalEq(col, val);
      };
      return builder;
    });

    await GET(makeRequest());

    // Every table that has a user_id / subject_id filter must have been called with USER_ID
    const userIdCols = eqCalls.filter(([, , val]) => val === USER_ID);
    expect(userIdCols.length).toBeGreaterThan(0);

    // Spot-check the adverts table
    const advertsEq = eqCalls.filter(([table, col, val]) => table === "adverts" && col === "user_id" && val === USER_ID);
    expect(advertsEq.length).toBeGreaterThan(0);

    // Spot-check the messages table
    const messagesEq = eqCalls.filter(([table, col, val]) => table === "messages" && col === "author_id" && val === USER_ID);
    expect(messagesEq.length).toBeGreaterThan(0);

    // Spot-check the profiles table uses id = user.id
    const profilesEq = eqCalls.filter(([table, col, val]) => table === "profiles" && col === "id" && val === USER_ID);
    expect(profilesEq.length).toBeGreaterThan(0);
  });

  // ── 4. Sub-query error → partial export, still 200 ───────────────────────
  it("when messages query errors, still returns 200 with messages: null and other sections intact", async () => {
    setupHappyPath();

    // Override messages to return an error
    mockFromTable.set("messages", () =>
      Promise.resolve({ data: null, error: { message: "DB error", code: "500" } }),
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    const d = body.data;

    // Messages errored → should be null
    expect(d.messages).toBeNull();

    // Other sections still work
    expect(d.profile).not.toBeNull();
    expect(Array.isArray(d.listings)).toBe(true);
    expect(Array.isArray(d.favorites)).toBe(true);
  });

  // ── 5. Profile query error → section null, rest present ──────────────────
  it("when profile query errors, section is null but other sections are present", async () => {
    setupHappyPath();

    mockFromTable.set("profiles", () =>
      Promise.resolve({ data: null, error: { message: "permission denied", code: "42501" } }),
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.profile).toBeNull();
    // listings still present
    expect(Array.isArray(body.data.listings)).toBe(true);
  });

  // ── 6. No sensitive internal fields in profile ────────────────────────────
  it("profile section does not contain blocked_until or rating", async () => {
    setupHappyPath();

    const res = await GET(makeRequest());
    const body = await res.json();
    const profile = body.data.profile;

    expect(profile).not.toHaveProperty("blocked_until");
    expect(profile).not.toHaveProperty("rating");
  });

  // ── 7. Response is NOT the {ok,data} envelope ─────────────────────────────
  it("response body is a raw export object, not the {ok, data} API envelope", async () => {
    setupHappyPath();

    const res = await GET(makeRequest());
    const body = await res.json();

    // Should NOT have top-level ok/data as from createSuccessResponse
    expect(body).not.toHaveProperty("ok");
    // The top-level should have exported_at + subject + data
    expect(body).toHaveProperty("exported_at");
    expect(body).toHaveProperty("subject");
    expect(body).toHaveProperty("data");
  });
});
