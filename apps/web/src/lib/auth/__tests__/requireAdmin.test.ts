import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();
const getAalMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({
    auth: {
      getUser: getUserMock,
      mfa: { getAuthenticatorAssuranceLevel: getAalMock },
    },
  }),
}));

const { getAdminAccess } = await import("../requireAdmin");

describe("getAdminAccess", () => {
  beforeEach(() => vi.resetAllMocks());

  it("rejects an unauthenticated request", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await expect(getAdminAccess()).resolves.toEqual({ ok: false, reason: "unauthenticated" });
    expect(getAalMock).not.toHaveBeenCalled();
  });

  it("rejects an untrusted user_metadata admin claim", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "u1", app_metadata: {}, user_metadata: { role: "admin" } } },
    });
    await expect(getAdminAccess()).resolves.toEqual({ ok: false, reason: "forbidden" });
  });

  it("requires AAL2 for an authoritative admin", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "admin", app_metadata: { role: "admin" } } },
    });
    getAalMock.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
    await expect(getAdminAccess()).resolves.toEqual({ ok: false, reason: "mfa_required" });
  });

  it("admits an authoritative admin only at AAL2", async () => {
    const user = { id: "admin", app_metadata: { roles: ["ops", "ADMIN"] } };
    getUserMock.mockResolvedValue({ data: { user } });
    getAalMock.mockResolvedValue({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null });
    await expect(getAdminAccess()).resolves.toEqual({ ok: true, user });
  });
});
