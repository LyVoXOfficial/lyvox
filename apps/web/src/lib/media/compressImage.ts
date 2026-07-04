// Client-side image downscale/compression before upload (supply-funnel fix:
// camera originals are 3–8 MB and either exceed the 5 MB server cap or crawl
// over mobile uplink; ~1600px WebP lands at ~200–400 KB with no visible loss
// for listing photos).

const MAX_DIMENSION = 1600;
const PREVIEW_MAX_DIMENSION = 400;
const WEBP_QUALITY = 0.82;
const PREVIEW_WEBP_QUALITY = 0.75;
const JPEG_QUALITY = 0.85;
// Below this size the roundtrip isn't worth it (icons, screenshots, already-tiny files).
const SKIP_BELOW_BYTES = 400 * 1024;

const decode = async (file: File): Promise<ImageBitmap | HTMLImageElement> => {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to <img> decoding (some browsers reject certain sources)
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    img.src = url;
  });
};

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

type EncodeOptions = {
  maxDimension: number;
  webpQuality: number;
  jpegQuality: number;
  skipBelowBytes?: number;
  suffix?: string;
};

async function resizeImage(file: File, options: EncodeOptions): Promise<File> {
  try {
    if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

    const source = await decode(file);
    const srcW = "width" in source ? source.width : 0;
    const srcH = "height" in source ? source.height : 0;
    if (!srcW || !srcH) return file;

    const scale = Math.min(1, options.maxDimension / Math.max(srcW, srcH));
    if (scale === 1 && options.skipBelowBytes && file.size <= options.skipBelowBytes) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(srcW * scale);
    canvas.height = Math.round(srcH * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    if ("close" in source) source.close();

    let blob = await toBlob(canvas, "image/webp", options.webpQuality);
    let ext = "webp";
    if (!blob || blob.type !== "image/webp") {
      blob = await toBlob(canvas, "image/jpeg", options.jpegQuality);
      ext = "jpg";
    }
    if (!blob || blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}${options.suffix ?? ""}.${ext}`, { type: blob.type });
  } catch {
    return file;
  }
}

/**
 * Downscale to MAX_DIMENSION and re-encode as WebP (JPEG fallback).
 * Never throws: any failure returns the original file untouched.
 * GIFs are passed through (canvas would drop animation).
 */
export async function compressImage(file: File): Promise<File> {
  return resizeImage(file, {
    maxDimension: MAX_DIMENSION,
    webpQuality: WEBP_QUALITY,
    jpegQuality: JPEG_QUALITY,
    skipBelowBytes: SKIP_BELOW_BYTES,
  });
}

export async function compressImageVariants(file: File): Promise<{ full: File; preview: File | null }> {
  const full = await compressImage(file);
  if (!full.type.startsWith("image/") || full.type === "image/gif") {
    return { full, preview: null };
  }

  const preview = await resizeImage(full, {
    maxDimension: PREVIEW_MAX_DIMENSION,
    webpQuality: PREVIEW_WEBP_QUALITY,
    jpegQuality: JPEG_QUALITY,
    suffix: "-400",
  });

  return { full, preview: preview === full ? null : preview };
}
