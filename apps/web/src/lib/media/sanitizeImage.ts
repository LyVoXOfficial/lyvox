// SEC-UPLOAD: server-side image sanitisation.
//
// Upload bytes reach Supabase Storage directly from the browser via a signed
// upload URL — they never pass through a Next.js route on the way up. So the
// ONLY server-side interception point is /api/media/complete, which downloads
// the freshly-uploaded object and hands the bytes here.
//
// This module is the security control. It:
//   1. sniffs the real container format from magic bytes (client Content-Type
//      is untrusted),
//   2. rejects animated containers (larger decoder attack surface + frame-count
//      bombs) by fourcc marker,
//   3. bounds the decode against decompression bombs (pixel + byte + time caps),
//   4. RE-ENCODES through sharp to a normalised WebP — which is the real
//      neutraliser: a polyglot's trailing payload and all metadata (EXIF/GPS/
//      ICC/XMP) are dropped because we never call withMetadata().
//
// It never throws: every failure path returns { ok: false, reason }. The caller
// maps a failure to an HTTP 4xx and deletes the orphaned upload.
import sharp from "sharp";

/** Container formats we accept as INPUT (magic-byte sniff vocabulary). */
export const ALLOWED_INPUT_FORMATS = new Set([
  "jpeg",
  "png",
  "webp",
  "avif",
  "gif",
]);

// libvips reports formats with its own vocabulary — notably AVIF decodes through
// the HEIF loader and surfaces as "heif". This is the set `metadata().format`
// may return for an ALLOWED_INPUT_FORMATS input.
const ALLOWED_VIPS_FORMATS = new Set(["jpeg", "png", "webp", "gif", "heif"]);

export type SanitizeReason =
  | "EMPTY"
  | "TOO_LARGE"
  | "UNKNOWN_FORMAT"
  | "ANIMATED_UNSUPPORTED"
  | "NOT_AN_IMAGE"
  | "TOO_MANY_PIXELS"
  | "DECODE_FAILED";

export type SanitizeOptions = {
  /** Hard cap on input byte length (belt-and-suspenders with the bucket file_size_limit). */
  maxBytes: number;
  /** Decompression-bomb guard: reject if width*height exceeds this before decoding. */
  maxInputPixels: number;
  /** Longest output edge; larger inputs are downscaled (never upscaled). */
  maxDimension: number;
  /** WebP output quality (1-100). */
  quality: number;
  /** libvips pipeline wall-clock timeout, seconds. */
  timeoutSeconds: number;
};

export const DEFAULT_SANITIZE_OPTIONS: SanitizeOptions = {
  maxBytes: 5 * 1024 * 1024, // mirrors signMediaSchema fileSize cap + ad-media bucket limit
  maxInputPixels: 40_000_000, // 40 MP — comfortably above any real phone photo
  maxDimension: 1600, // mirrors client compressImage MAX_DIMENSION
  quality: 82,
  timeoutSeconds: 15,
};

export type SanitizeSuccess = {
  ok: true;
  buffer: Buffer;
  format: "webp";
  width: number;
  height: number;
  bytes: number;
};

export type SanitizeFailure = { ok: false; reason: SanitizeReason };
export type SanitizeResult = SanitizeSuccess | SanitizeFailure;

/**
 * Detect the real image container from its magic bytes. Returns null for
 * anything that isn't one of our allowed raster formats — the client-supplied
 * Content-Type is never trusted.
 */
export function sniffImageFormat(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }

  // GIF: "GIF87a" | "GIF89a"
  const head6 = buffer.toString("latin1", 0, 6);
  if (head6 === "GIF87a" || head6 === "GIF89a") return "gif";

  // WEBP: "RIFF" .... "WEBP"
  if (buffer.toString("latin1", 0, 4) === "RIFF" && buffer.toString("latin1", 8, 12) === "WEBP") {
    return "webp";
  }

  // AVIF/HEIF (ISO-BMFF): "ftyp" box at offset 4, brand in the avif/heif family.
  if (buffer.toString("latin1", 4, 8) === "ftyp") {
    const brand = buffer.toString("latin1", 8, 12);
    if (["avif", "avis", "heic", "heix", "mif1", "msf1"].includes(brand)) return "avif";
  }

  return null;
}

/**
 * Reject animated containers up-front by their distinctive fourcc/marker, so we
 * never opt sharp into multi-page decoding (frame-count-bomb surface). The
 * marker search is scoped to the header/chunk region to avoid false positives
 * from pixel data. Static images of the same format do NOT carry these markers.
 */
export function isAnimatedContainer(buffer: Buffer, format: string): boolean {
  // GIF: the NETSCAPE2.0 application extension drives looping — present in
  // essentially every animated GIF, and never in a static one.
  if (format === "gif") {
    return buffer.includes(Buffer.from("NETSCAPE2.0", "latin1"));
  }
  // Animated WebP: an "ANIM" global chunk follows the VP8X header near the
  // start of the RIFF container.
  if (format === "webp") {
    return buffer.subarray(0, 4096).includes(Buffer.from("ANIM", "latin1"));
  }
  // APNG: the "acTL" animation-control chunk must appear before the first IDAT.
  if (format === "png") {
    return buffer.subarray(0, 4096).includes(Buffer.from("acTL", "latin1"));
  }
  return false;
}

/**
 * Sniff → guard → re-encode an untrusted image buffer into a clean WebP.
 * Never throws. On any rejection returns { ok: false, reason }.
 */
export async function sanitizeImageBuffer(
  input: Buffer,
  options: Partial<SanitizeOptions> = {},
): Promise<SanitizeResult> {
  const opts = { ...DEFAULT_SANITIZE_OPTIONS, ...options };

  if (!input || input.length === 0) return { ok: false, reason: "EMPTY" };
  if (input.length > opts.maxBytes) return { ok: false, reason: "TOO_LARGE" };

  const sniffed = sniffImageFormat(input);
  if (!sniffed || !ALLOWED_INPUT_FORMATS.has(sniffed)) {
    return { ok: false, reason: "UNKNOWN_FORMAT" };
  }

  if (isAnimatedContainer(input, sniffed)) {
    return { ok: false, reason: "ANIMATED_UNSUPPORTED" };
  }

  try {
    // Read the header only (no pixels decoded yet) to enforce the pixel cap
    // BEFORE allocating a canvas — this is the decompression-bomb guard.
    const meta = await sharp(input, {
      limitInputPixels: opts.maxInputPixels,
      failOn: "error",
    }).metadata();

    if (!meta.format || !ALLOWED_VIPS_FORMATS.has(meta.format)) {
      return { ok: false, reason: "NOT_AN_IMAGE" };
    }

    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (width <= 0 || height <= 0) return { ok: false, reason: "NOT_AN_IMAGE" };
    if (width * height > opts.maxInputPixels) {
      return { ok: false, reason: "TOO_MANY_PIXELS" };
    }

    // Re-encode: auto-orient from EXIF then drop it (no withMetadata()), cap the
    // output edge, emit WebP. limitInputPixels + timeout bound the work.
    const outBuffer = await sharp(input, {
      limitInputPixels: opts.maxInputPixels,
      failOn: "error",
    })
      .timeout({ seconds: opts.timeoutSeconds })
      .rotate()
      .resize(opts.maxDimension, opts.maxDimension, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: opts.quality })
      .toBuffer();

    const outMeta = await sharp(outBuffer).metadata();
    return {
      ok: true,
      buffer: outBuffer,
      format: "webp",
      width: outMeta.width ?? 0,
      height: outMeta.height ?? 0,
      bytes: outBuffer.length,
    };
  } catch {
    // Corrupt bytes, wrong-format-inside a valid header, pixel-limit trip, or
    // timeout — all land here. The worker survives; the upload is rejected.
    return { ok: false, reason: "DECODE_FAILED" };
  }
}

/**
 * Derive a small preview WebP from an ALREADY-SANITISED full buffer. Because the
 * input is the output of sanitizeImageBuffer (safe, bounded, metadata-free),
 * this needs no re-validation. Used to overwrite the client-uploaded preview in
 * the PUBLIC ad-media-preview bucket so nothing attacker-controlled is served.
 */
export async function derivePreviewBuffer(
  sanitizedFull: Buffer,
  options: { maxDimension?: number; quality?: number } = {},
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const maxDimension = options.maxDimension ?? 400;
  const quality = options.quality ?? 75;

  const buffer = await sharp(sanitizedFull)
    .resize(maxDimension, maxDimension, { fit: "inside", withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();

  const meta = await sharp(buffer).metadata();
  return { buffer, width: meta.width ?? 0, height: meta.height ?? 0 };
}
