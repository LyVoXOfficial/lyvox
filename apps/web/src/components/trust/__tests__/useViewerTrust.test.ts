import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { fetchViewerTrust } = await import("@/components/trust/useViewerTrust");

describe("fetchViewerTrust", () => {
  beforeEach(() => fetchMock.mockReset());
  afterEach(() => vi.clearAllMocks());

  it("signed-in + verified (wrapped envelope)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, data: { user: { id: "u1" }, verifiedPhone: true } }) });
    expect(await fetchViewerTrust()).toEqual({ signedIn: true, verifiedPhone: true, userId: "u1" });
  });
  it("signed-in + unverified (wrapped envelope)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, data: { user: { id: "u2" }, verifiedPhone: false } }) });
    expect(await fetchViewerTrust()).toEqual({ signedIn: true, verifiedPhone: false, userId: "u2" });
  });
  it("signed-in + verified (flat shape fallback)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ user: { id: "u3" }, verifiedPhone: true }) });
    expect(await fetchViewerTrust()).toEqual({ signedIn: true, verifiedPhone: true, userId: "u3" });
  });
  it("not signed in (no user)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, data: { user: null } }) });
    expect(await fetchViewerTrust()).toEqual({ signedIn: false, verifiedPhone: false, userId: null });
  });
  it("network error → not signed in", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await fetchViewerTrust()).toEqual({ signedIn: false, verifiedPhone: false, userId: null });
  });
});
