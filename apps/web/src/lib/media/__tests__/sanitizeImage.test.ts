// @vitest-environment node
//
// SEC-UPLOAD: the security-critical core is tested against REAL sharp with real
// image bytes — mocking sharp here would test nothing. Fixtures are generated at
// runtime so no binary blobs live in the repo.
import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import {
  sniffImageFormat,
  isAnimatedContainer,
  sanitizeImageBuffer,
  derivePreviewBuffer,
  ALLOWED_INPUT_FORMATS,
} from "../sanitizeImage";

// --- fixture builders -------------------------------------------------------

const solid = (w: number, h: number, r = 120, g = 80, b = 200) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r, g, b } } });

let jpeg: Buffer;
let png: Buffer;
let webp: Buffer;
let gif: Buffer;
let avif: Buffer;
let jpegWithExif: Buffer;

beforeAll(async () => {
  jpeg = await solid(48, 32).jpeg().toBuffer();
  png = await solid(48, 32).png().toBuffer();
  webp = await solid(48, 32).webp().toBuffer();
  gif = await solid(48, 32).gif().toBuffer();
  avif = await solid(48, 32).avif().toBuffer();
  // sharp's typed withExif exposes IFD0-3; embedding a copyright + a geo-tagged
  // description is enough — sanitisation drops the ENTIRE EXIF block (every IFD,
  // GPS included) because we never call withMetadata().
  jpegWithExif = await solid(48, 32)
    .withExif({
      IFD0: { Copyright: "LyVoX-secret-owner", ImageDescription: "geo:50.8503,4.3517" },
    })
    .jpeg()
    .toBuffer();
}, 20_000);

const hasExif = async (buf: Buffer) => Boolean((await sharp(buf).metadata()).exif);

// --- magic-byte sniffing ----------------------------------------------------

describe("sniffImageFormat", () => {
  it("detects each allowed container from magic bytes", async () => {
    expect(sniffImageFormat(jpeg)).toBe("jpeg");
    expect(sniffImageFormat(png)).toBe("png");
    expect(sniffImageFormat(webp)).toBe("webp");
    expect(sniffImageFormat(gif)).toBe("gif");
    expect(sniffImageFormat(avif)).toBe("avif");
  });

  it("returns null for non-image bytes regardless of a claimed extension", () => {
    expect(sniffImageFormat(Buffer.from("%PDF-1.7\n%\xE2\xE3\xCF\xD3 not an image"))).toBeNull();
    expect(sniffImageFormat(Buffer.from("<html><body>hi</body></html>"))).toBeNull();
    expect(sniffImageFormat(Buffer.from([0x00, 0x01, 0x02]))).toBeNull();
  });

  it("does not mistake a PNG signature prefix on a truncated buffer", () => {
    // 8-byte PNG signature but < 12 bytes total → too short to be a real image.
    expect(sniffImageFormat(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBeNull();
  });
});

// --- animated rejection -----------------------------------------------------

describe("isAnimatedContainer", () => {
  it("flags GIF with the NETSCAPE2.0 looping extension", () => {
    const animatedish = Buffer.concat([gif, Buffer.from("NETSCAPE2.0", "latin1")]);
    expect(isAnimatedContainer(animatedish, "gif")).toBe(true);
    expect(isAnimatedContainer(gif, "gif")).toBe(false);
  });

  it("flags animated WebP by the ANIM chunk", () => {
    const animWebp = Buffer.concat([
      Buffer.from("RIFF____WEBPVP8X", "latin1"),
      Buffer.from("ANIM", "latin1"),
      webp,
    ]);
    expect(isAnimatedContainer(animWebp, "webp")).toBe(true);
    expect(isAnimatedContainer(webp, "webp")).toBe(false);
  });

  it("flags APNG by the acTL control chunk", () => {
    const apng = Buffer.concat([png.subarray(0, 33), Buffer.from("acTL", "latin1"), png.subarray(33)]);
    expect(isAnimatedContainer(apng, "png")).toBe(true);
    expect(isAnimatedContainer(png, "png")).toBe(false);
  });
});

// --- happy paths ------------------------------------------------------------

describe("sanitizeImageBuffer — accepted inputs", () => {
  it.each([
    ["jpeg", () => jpeg],
    ["png", () => png],
    ["webp", () => webp],
    ["gif", () => gif],
    ["avif", () => avif],
  ])("re-encodes %s to WebP", async (_name, get) => {
    const result = await sanitizeImageBuffer(get());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.format).toBe("webp");
    expect(sniffImageFormat(result.buffer)).toBe("webp");
    expect(result.width).toBe(48);
    expect(result.height).toBe(32);
    expect(result.bytes).toBe(result.buffer.length);
  });

  it("downscales an oversized image to maxDimension while preserving aspect ratio", async () => {
    const big = await solid(2000, 1500).png().toBuffer();
    const result = await sanitizeImageBuffer(big); // default maxDimension 1600
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Math.max(result.width, result.height)).toBe(1600);
    expect(result.width).toBe(1600);
    expect(result.height).toBe(1200);
  });
});

// --- security properties ----------------------------------------------------

describe("sanitizeImageBuffer — security", () => {
  it("strips EXIF/GPS metadata (privacy: no geolocation leak)", async () => {
    expect(await hasExif(jpegWithExif)).toBe(true); // fixture really carries EXIF
    const result = await sanitizeImageBuffer(jpegWithExif);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await hasExif(result.buffer)).toBe(false);
    // and the raw copyright/owner string is gone from the bytes
    expect(result.buffer.includes(Buffer.from("LyVoX-secret-owner", "latin1"))).toBe(false);
  });

  it("neutralises a polyglot: re-encode drops appended non-image payload", async () => {
    const payload = "<?php system($_GET['c']); ?> POLYGLOT_MARKER";
    const polyglot = Buffer.concat([jpeg, Buffer.from(payload, "latin1")]);
    const result = await sanitizeImageBuffer(polyglot);
    expect(result.ok).toBe(true); // the leading image is valid → accepted + cleaned
    if (!result.ok) return;
    expect(result.buffer.includes(Buffer.from("POLYGLOT_MARKER", "latin1"))).toBe(false);
    expect(result.format).toBe("webp");
  });

  it("rejects a valid PNG header wrapping non-image bytes", async () => {
    const fakePng = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("this is absolutely not a real PNG body ".repeat(4), "latin1"),
    ]);
    const result = await sanitizeImageBuffer(fakePng);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("DECODE_FAILED");
  });

  it("rejects non-image bytes (unknown format) before touching sharp", async () => {
    const result = await sanitizeImageBuffer(Buffer.from("just some text, not an image at all!!"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("UNKNOWN_FORMAT");
  });

  it("rejects an empty buffer", async () => {
    const result = await sanitizeImageBuffer(Buffer.alloc(0));
    expect(result).toEqual({ ok: false, reason: "EMPTY" });
  });

  it("rejects an over-size buffer before decoding", async () => {
    const result = await sanitizeImageBuffer(jpeg, { maxBytes: 10 });
    expect(result).toEqual({ ok: false, reason: "TOO_LARGE" });
  });

  it("rejects a decompression bomb via the pixel cap without crashing", async () => {
    // 48*32 = 1536 px, cap set absurdly low → rejected from header dims alone.
    const result = await sanitizeImageBuffer(jpeg, { maxInputPixels: 100 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(["TOO_MANY_PIXELS", "DECODE_FAILED"]).toContain(result.reason);
  });

  it("rejects animated GIF (NETSCAPE2.0) rather than silently flattening", async () => {
    const animatedish = Buffer.concat([gif, Buffer.from("NETSCAPE2.0", "latin1")]);
    const result = await sanitizeImageBuffer(animatedish);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("ANIMATED_UNSUPPORTED");
  });
});

// --- preview derivation -----------------------------------------------------

describe("derivePreviewBuffer", () => {
  it("produces a small WebP preview from a sanitised full buffer", async () => {
    const full = await sanitizeImageBuffer(await solid(1200, 900).png().toBuffer());
    expect(full.ok).toBe(true);
    if (!full.ok) return;
    const preview = await derivePreviewBuffer(full.buffer);
    expect(sniffImageFormat(preview.buffer)).toBe("webp");
    expect(Math.max(preview.width, preview.height)).toBeLessThanOrEqual(400);
    expect(preview.width).toBe(400);
    expect(preview.height).toBe(300);
  });
});

describe("ALLOWED_INPUT_FORMATS", () => {
  it("is the expected allowlist", () => {
    expect([...ALLOWED_INPUT_FORMATS].sort()).toEqual(["avif", "gif", "jpeg", "png", "webp"]);
  });
});
