import { describe, it, expect, vi, beforeEach } from "vitest";
import { eraseAccount, ActiveBusinessError } from "@/lib/account/erasure";

// ─── Mock factory ────────────────────────────────────────────────────────────
//
// We build a fully-instrumented fake SupabaseClient on each test so we can:
//  • drive rpc / from / storage / auth results independently per test
//  • assert call order via invocationCallOrder
//
function makeService({
  rpcError = null as null | { message?: string; code?: string },
  advertRows = [] as { id: string }[],
  mediaRows = [] as { url: string; preview_url?: string | null }[],
  storageError = null as null | Error,
  deleteUserError = null as null | { message: string },
} = {}) {
  const rpc = vi.fn().mockResolvedValue({ error: rpcError, data: null });

  const mediaIn = vi.fn().mockResolvedValue({ data: mediaRows, error: null });
  const mediaSelect = vi.fn().mockReturnValue({ in: mediaIn });

  const advertEq = vi.fn().mockResolvedValue({ data: advertRows, error: null });
  const advertSelect = vi.fn().mockReturnValue({ eq: advertEq });

  // from() branches on table name
  const from = vi.fn((table: string) => {
    if (table === "adverts") return { select: advertSelect };
    if (table === "media") return { select: mediaSelect };
    return {};
  });

  const storageRemove = vi.fn(() =>
    storageError ? Promise.reject(storageError) : Promise.resolve({ data: null, error: null }),
  );
  const previewStorageRemove = vi.fn(() =>
    storageError ? Promise.reject(storageError) : Promise.resolve({ data: null, error: null }),
  );
  const storage = {
    from: vi.fn((bucket: string) => ({
      remove: bucket === "ad-media-preview" ? previewStorageRemove : storageRemove,
    })),
  };

  const deleteUser = vi.fn().mockResolvedValue({ error: deleteUserError, data: null });
  const auth = { admin: { deleteUser } };

  return { rpc, from, storage, auth, _mocks: { storageRemove, previewStorageRemove, deleteUser } };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("eraseAccount", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("happy path: calls rpc → storage.remove (non-http paths) → deleteUser in order", async () => {
    const svc = makeService({
      advertRows: [{ id: "adv-1" }, { id: "adv-2" }],
      mediaRows: [
        { url: "https://cdn.example.com/preview-only-1.jpg", preview_url: "user/adv-1/previews/photo-400.webp" },
        { url: "https://cdn.example.com/preview-only-2.jpg", preview_url: "user/adv-2/previews/photo-400.webp" },
        { url: "ad-media/user/adv-1/photo.jpg" },   // storage path — included
        { url: "https://cdn.example.com/img.jpg" },  // full URL — excluded
        { url: "ad-media/user/adv-2/photo.jpg" },   // storage path — included
      ],
    });

    await eraseAccount(svc as unknown as Parameters<typeof eraseAccount>[0], "user-123");

    // rpc called once with correct arg
    expect(svc.rpc).toHaveBeenCalledOnce();
    expect(svc.rpc).toHaveBeenCalledWith("erase_user_data", { p_user_id: "user-123" });

    // adverts fetched for the right user
    expect(svc.from).toHaveBeenCalledWith("adverts");
    expect(svc.from).toHaveBeenCalledWith("media");

    // storage.remove called with only non-http paths
    const { storageRemove, previewStorageRemove, deleteUser } = svc._mocks;
    expect(svc.storage.from).toHaveBeenCalledWith("ad-media");
    expect(svc.storage.from).toHaveBeenCalledWith("ad-media-preview");
    expect(storageRemove).toHaveBeenCalledOnce();
    expect(storageRemove).toHaveBeenCalledWith([
      "ad-media/user/adv-1/photo.jpg",
      "ad-media/user/adv-2/photo.jpg",
    ]);
    expect(previewStorageRemove).toHaveBeenCalledOnce();
    expect(previewStorageRemove).toHaveBeenCalledWith([
      "user/adv-1/previews/photo-400.webp",
      "user/adv-2/previews/photo-400.webp",
    ]);

    // deleteUser called once with userId
    expect(deleteUser).toHaveBeenCalledOnce();
    expect(deleteUser).toHaveBeenCalledWith("user-123");

    // ORDER: rpc < storage.remove < deleteUser
    const rpcOrder = svc.rpc.mock.invocationCallOrder[0];
    const removeOrder = storageRemove.mock.invocationCallOrder[0];
    const previewRemoveOrder = previewStorageRemove.mock.invocationCallOrder[0];
    const deleteOrder = deleteUser.mock.invocationCallOrder[0];
    expect(rpcOrder).toBeLessThan(removeOrder);
    expect(removeOrder).toBeLessThan(deleteOrder);
    expect(previewRemoveOrder).toBeLessThan(deleteOrder);
  });

  it("throws ActiveBusinessError on ACTIVE_BUSINESS rpc error (by message)", async () => {
    const svc = makeService({
      rpcError: { message: "ACTIVE_BUSINESS", code: "P0001" },
    });

    await expect(
      eraseAccount(svc as unknown as Parameters<typeof eraseAccount>[0], "user-biz"),
    ).rejects.toThrow(ActiveBusinessError);

    // storage and deleteUser must NOT be called
    expect(svc._mocks.storageRemove).not.toHaveBeenCalled();
    expect(svc._mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("throws ActiveBusinessError when only code=P0001 (no ACTIVE_BUSINESS in message)", async () => {
    const svc = makeService({
      rpcError: { message: "raise exception", code: "P0001" },
    });

    await expect(
      eraseAccount(svc as unknown as Parameters<typeof eraseAccount>[0], "user-biz2"),
    ).rejects.toThrow(ActiveBusinessError);

    expect(svc._mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("throws generic Error on a non-P0001 rpc error and does NOT call deleteUser", async () => {
    const svc = makeService({
      rpcError: { message: "connection timeout", code: "08006" },
    });

    await expect(
      eraseAccount(svc as unknown as Parameters<typeof eraseAccount>[0], "user-err"),
    ).rejects.toThrow(/connection timeout/);

    expect(svc._mocks.deleteUser).not.toHaveBeenCalled();
    expect(svc._mocks.storageRemove).not.toHaveBeenCalled();
  });

  it("no adverts → storage.remove not called, deleteUser still called", async () => {
    const svc = makeService({ advertRows: [] });

    await eraseAccount(svc as unknown as Parameters<typeof eraseAccount>[0], "user-noadverts");

    expect(svc._mocks.storageRemove).not.toHaveBeenCalled();
    expect(svc._mocks.deleteUser).toHaveBeenCalledOnce();
    expect(svc._mocks.deleteUser).toHaveBeenCalledWith("user-noadverts");
  });

  it("all media has http URLs → storage.remove not called, deleteUser still called", async () => {
    const svc = makeService({
      advertRows: [{ id: "adv-x" }],
      mediaRows: [
        { url: "https://cdn.example.com/a.jpg" },
        { url: "https://cdn.example.com/b.jpg" },
      ],
    });

    await eraseAccount(svc as unknown as Parameters<typeof eraseAccount>[0], "user-http");

    expect(svc._mocks.storageRemove).not.toHaveBeenCalled();
    expect(svc._mocks.deleteUser).toHaveBeenCalledOnce();
  });

  it("storage error: logs error, does NOT prevent deleteUser (non-fatal)", async () => {
    const svc = makeService({
      advertRows: [{ id: "adv-1" }],
      mediaRows: [{ url: "ad-media/user/adv-1/photo.jpg" }],
      storageError: new Error("bucket quota exceeded"),
    });

    // should NOT throw
    await expect(
      eraseAccount(svc as unknown as Parameters<typeof eraseAccount>[0], "user-se"),
    ).resolves.toBeUndefined();

    // deleteUser still called
    expect(svc._mocks.deleteUser).toHaveBeenCalledOnce();
    expect(svc._mocks.deleteUser).toHaveBeenCalledWith("user-se");

    // error was logged
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringMatching(/Storage cleanup failed/),
      expect.any(Error),
    );
  });

  it("ActiveBusinessError has name 'ActiveBusinessError'", () => {
    const err = new ActiveBusinessError();
    expect(err.name).toBe("ActiveBusinessError");
    expect(err).toBeInstanceOf(ActiveBusinessError);
    expect(err).toBeInstanceOf(Error);
  });

  it("deleteUser error → throws", async () => {
    const svc = makeService({
      deleteUserError: { message: "user not found in auth" },
    });

    await expect(
      eraseAccount(svc as unknown as Parameters<typeof eraseAccount>[0], "user-gone"),
    ).rejects.toThrow(/user not found in auth/);
  });
});
