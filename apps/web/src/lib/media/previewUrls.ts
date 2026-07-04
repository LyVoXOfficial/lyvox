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
