const HTTP_URL_REGEX = /^https?:\/\//i;
const PREVIEW_BUCKET = "ad-media-preview";

const trimSlash = (value: string) => value.replace(/\/+$/, "");
const trimLeadingSlash = (value: string) => value.replace(/^\/+/, "");

export function getMediaPreviewPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (HTTP_URL_REGEX.test(path)) return path;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!supabaseUrl) return null;

  return `${trimSlash(supabaseUrl)}/storage/v1/object/public/${PREVIEW_BUCKET}/${trimLeadingSlash(path)}`;
}

export function isStoragePath(path: string | null | undefined): path is string {
  return Boolean(path && !HTTP_URL_REGEX.test(path));
}

/**
 * Deterministically derive the preview object path (in the PUBLIC ad-media-preview
 * bucket) from a full-image storage path. SEC-UPLOAD: the preview is written
 * ONLY by the server (in /api/media/complete, from the sanitised full buffer) —
 * the client never uploads to the public preview bucket — so the path is computed
 * here rather than accepted from the request.
 */
export function buildPreviewStoragePath(fullStoragePath: string): string {
  const slashIndex = fullStoragePath.lastIndexOf("/");
  const dir = slashIndex >= 0 ? fullStoragePath.slice(0, slashIndex) : "";
  const file = slashIndex >= 0 ? fullStoragePath.slice(slashIndex + 1) : fullStoragePath;
  const base = file.replace(/\.[^.]+$/, "") || "photo";
  return `${dir}/previews/${base}-400.webp`;
}
