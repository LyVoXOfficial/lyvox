/**
 * Route-level tests for POST /api/media/complete, focused on the SEC-UPLOAD
 * sanitisation orchestration: bytes are downloaded, run through
 * sanitizeImageBuffer, re-uploaded as clean WebP, the public preview is
 * regenerated from the sanitised buffer, and rejects delete the orphaned
 * upload(s) without ever inserting a media row.
 *
 * sanitizeImageBuffer / derivePreviewBuffer are mocked here — their real-sharp
 * behaviour is covered in lib/media/__tests__/sanitizeImage.test.ts.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const getUserMock = vi.fn();
const serverFromMock = vi.fn();

const downloadMock = vi.fn();
const uploadMock = vi.fn();
const removeMock = vi.fn();
const createSignedUrlMock = vi.fn();
const logsInsertMock = vi.fn(async () => ({ error: null }));
const storageFromMock = vi.fn(() => ({
  download: downloadMock,
  upload: uploadMock,
  remove: removeMock,
  createSignedUrl: createSignedUrlMock,
}));

const sanitizeMock = vi.fn();
const derivePreviewMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({ auth: { getUser: getUserMock }, from: serverFromMock }),
}));

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({
    storage: { from: storageFromMock },
    from: (table: string) => {
      if (table === "logs") return { insert: logsInsertMock };
      throw new Error("unexpected service table " + table);
    },
  }),
}));

vi.mock("@/lib/media/sanitizeImage", () => ({
  sanitizeImageBuffer: sanitizeMock,
  derivePreviewBuffer: derivePreviewMock,
}));

const limiterMock = vi.fn(async () => ({ success: true, limit: 30, remaining: 29, reset: 0, retryAfterSec: 0 }));
vi.mock("@/lib/rateLimiter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rateLimiter")>();
  return { ...actual, createRateLimiter: () => limiterMock };
});

const { POST } = await import("../route");

// ---------------------------------------------------------------------------

const ADVERT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "user-1";
const STORAGE_PATH = `${USER_ID}/${ADVERT_ID}/photo.jpg`;
const PREVIEW_PATH = `${USER_ID}/${ADVERT_ID}/previews/photo-400.webp`;

const VALID_BODY = {
  advertId: ADVERT_ID,
  storagePath: STORAGE_PATH,
  // client dims are deliberately WRONG to prove the server recomputes them
  width: 9999,
  height: 9999,
  previewStoragePath: PREVIEW_PATH,
  previewWidth: 9999,
  previewHeight: 9999,
};

function completeReq(body: unknown = VALID_BODY) {
  return new Request("https://x.test/api/media/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

let insertPayloadCapture: Record<string, unknown> | null = null;

/** Owner ok; under limit; optional existing row; standard lastSort + insert. */
function makeServerFrom(existingRow: unknown = null) {
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
        select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count) return { eq: () => Promise.resolve({ count: 0, error: null }) };
          return {
            eq: () => ({
              // existing-path check: .eq().eq().maybeSingle()
              eq: () => ({ maybeSingle: async () => ({ data: existingRow, error: null }) }),
              // lastSort: .eq().order().limit().maybeSingle()
              order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
            }),
          };
        },
        insert: (payload: Record<string, unknown>) => {
          insertPayloadCapture = payload;
          return {
            select: () => ({
              single: async () => ({
                data: {
                  id: "media-1",
                  url: STORAGE_PATH,
                  sort: payload.sort,
                  w: payload.w,
                  h: payload.h,
                  preview_url: payload.preview_url,
                  preview_w: payload.preview_w,
                  preview_h: payload.preview_h,
                },
                error: null,
              }),
            }),
          };
        },
      };
    }
    throw new Error("unexpected table " + table);
  };
}

const blobLike = { arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff]).buffer };

describe("POST /api/media/complete — SEC-UPLOAD sanitisation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertPayloadCapture = null;
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    serverFromMock.mockImplementation(makeServerFrom(null));
    downloadMock.mockResolvedValue({ data: blobLike, error: null });
    uploadMock.mockResolvedValue({ data: { path: STORAGE_PATH }, error: null });
    removeMock.mockResolvedValue({ data: [], error: null });
    createSignedUrlMock.mockResolvedValue({ data: { signedUrl: "https://signed.example/x" }, error: null });
    sanitizeMock.mockResolvedValue({
      ok: true,
      buffer: Buffer.from("clean-webp"),
      format: "webp",
      width: 800,
      height: 600,
      bytes: 10,
    });
    derivePreviewMock.mockResolvedValue({ buffer: Buffer.from("preview"), width: 400, height: 300 });
    limiterMock.mockResolvedValue({ success: true, limit: 30, remaining: 29, reset: 0, retryAfterSec: 0 });
  });

  it("happy path: sanitises, re-uploads clean WebP, regenerates preview, stores server-computed dims", async () => {
    const res = await POST(completeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.media.id).toBe("media-1");

    // downloaded from the private bucket then sanitised
    expect(storageFromMock).toHaveBeenCalledWith("ad-media");
    expect(downloadMock).toHaveBeenCalledWith(STORAGE_PATH);
    expect(sanitizeMock).toHaveBeenCalledTimes(1);

    // re-uploaded as image/webp with upsert (overwrite the original object)
    const fullUpload = uploadMock.mock.calls.find((c) => c[0] === STORAGE_PATH);
    expect(fullUpload?.[2]).toEqual({ contentType: "image/webp", upsert: true });

    // public preview regenerated from the sanitised buffer, not trusted from client
    expect(derivePreviewMock).toHaveBeenCalledTimes(1);
    expect(storageFromMock).toHaveBeenCalledWith("ad-media-preview");
    const previewUpload = uploadMock.mock.calls.find((c) => c[0] === PREVIEW_PATH);
    expect(previewUpload?.[2]).toEqual({ contentType: "image/webp", upsert: true });

    // server-computed dims win over the (wrong) client-claimed 9999
    expect(insertPayloadCapture?.w).toBe(800);
    expect(insertPayloadCapture?.h).toBe(600);
    expect(insertPayloadCapture?.preview_w).toBe(400);
    expect(insertPayloadCapture?.preview_h).toBe(300);
    expect(insertPayloadCapture?.preview_mime).toBe("image/webp");
  });

  it("rejects a non-image (sanitiser fails) with 422 and deletes both orphaned objects, no row inserted", async () => {
    sanitizeMock.mockResolvedValue({ ok: false, reason: "DECODE_FAILED" });

    const res = await POST(completeReq());
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UNSUPPORTED_CONTENT_TYPE");

    // both orphans removed; nothing re-uploaded; no media row
    expect(removeMock).toHaveBeenCalledWith([STORAGE_PATH]);
    expect(removeMock).toHaveBeenCalledWith([PREVIEW_PATH]);
    expect(uploadMock).not.toHaveBeenCalled();
    expect(insertPayloadCapture).toBeNull();
  });

  it("maps an over-size rejection to 413 FILE_TOO_LARGE", async () => {
    sanitizeMock.mockResolvedValue({ ok: false, reason: "TOO_LARGE" });

    const res = await POST(completeReq());
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe("FILE_TOO_LARGE");
    expect(insertPayloadCapture).toBeNull();
  });

  it("rejects an animated upload (sanitiser ANIMATED_UNSUPPORTED) with 422", async () => {
    sanitizeMock.mockResolvedValue({ ok: false, reason: "ANIMATED_UNSUPPORTED" });

    const res = await POST(completeReq());
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("UNSUPPORTED_CONTENT_TYPE");
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("returns reused:true without sanitising when the media row already exists", async () => {
    serverFromMock.mockImplementation(makeServerFrom({ id: "existing-media" }));

    const res = await POST(completeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.reused).toBe(true);
    expect(downloadMock).not.toHaveBeenCalled();
    expect(sanitizeMock).not.toHaveBeenCalled();
  });

  it("404s and does not insert when the uploaded object is missing", async () => {
    downloadMock.mockResolvedValue({ data: null, error: { message: "not found" } });

    const res = await POST(completeReq());
    expect(res.status).toBe(404);
    expect(sanitizeMock).not.toHaveBeenCalled();
    expect(insertPayloadCapture).toBeNull();
    // the orphaned upload is cleaned up
    expect(removeMock).toHaveBeenCalledWith([STORAGE_PATH]);
  });

  it("403s (path not owned) before any download/sanitise", async () => {
    const res = await POST(completeReq({ ...VALID_BODY, storagePath: `someone-else/${ADVERT_ID}/x.jpg` }));
    expect(res.status).toBe(403);
    expect(downloadMock).not.toHaveBeenCalled();
    expect(sanitizeMock).not.toHaveBeenCalled();
  });

  it("drops the client preview (preview_url null) when preview regeneration fails, but still succeeds", async () => {
    derivePreviewMock.mockRejectedValue(new Error("sharp preview boom"));

    const res = await POST(completeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // un-sanitised client preview removed from the public bucket
    expect(removeMock).toHaveBeenCalledWith([PREVIEW_PATH]);
    expect(insertPayloadCapture?.preview_url).toBeNull();
    expect(insertPayloadCapture?.preview_mime).toBeNull();
  });
});
