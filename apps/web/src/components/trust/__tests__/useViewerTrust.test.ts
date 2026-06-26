import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { fetchViewerTrust } = await import("@/components/trust/useViewerTrust");

describe("fetchViewerTrust", () => {
  beforeEach(() => fetchMock.mockReset());
  afterEach(() => vi.clearAllMocks());

  it("signed-in + verified", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ user: { id: "u1" }, verifiedPhone: true }) });
    expect(await fetchViewerTrust()).toEqual({ signedIn: true, verifiedPhone: true, userId: "u1" });
  });
  it("signed-in + unverified", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ user: { id: "u2" }, verifiedPhone: false }) });
    expect(await fetchViewerTrust()).toEqual({ signedIn: true, verifiedPhone: false, userId: "u2" });
  });
  it("not signed in (no user)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ user: null }) });
    expect(await fetchViewerTrust()).toEqual({ signedIn: false, verifiedPhone: false, userId: null });
  });
  it("network error → not signed in", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await fetchViewerTrust()).toEqual({ signedIn: false, verifiedPhone: false, userId: null });
  });
});
