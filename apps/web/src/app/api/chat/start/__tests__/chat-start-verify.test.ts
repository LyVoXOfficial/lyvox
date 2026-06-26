import { describe, it, expect, beforeEach, vi } from "vitest";

const getUserMock = vi.fn();
const isVerifiedMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({ supabaseServer: async () => ({ auth: { getUser: getUserMock }, from: () => ({}) }) }));
vi.mock("@/lib/rateLimiter", () => ({
  createRateLimiter: () => async () => ({ success: true }),
  withRateLimit: (h: unknown) => h,
}));
vi.mock("@/lib/auth/requireVerified", () => ({ isViewerVerified: (...a: unknown[]) => isVerifiedMock(...(a as [])) }));

const { POST } = await import("../route");

describe("POST /api/chat/start verification gate", () => {
  beforeEach(() => { getUserMock.mockReset(); isVerifiedMock.mockReset(); });

  it("403 VERIFICATION_REQUIRED when signed in but unverified", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    isVerifiedMock.mockResolvedValue(false);
    const res = await POST(new Request("https://x.test/api/chat/start", { method: "POST", body: JSON.stringify({ peer_id: "11111111-1111-4111-8111-111111111111" }) }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("VERIFICATION_REQUIRED");
  });

  it("401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await POST(new Request("https://x.test/api/chat/start", { method: "POST", body: JSON.stringify({ peer_id: "11111111-1111-4111-8111-111111111111" }) }));
    expect(res.status).toBe(401);
  });
});
