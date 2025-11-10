import type { MediaItemWithUrl, SignedMediaItem } from "@/lib/media/signMediaUrls";

export type SortableMedia<T> = (MediaItemWithUrl<T> & { sort?: number | null }) | SignedMediaItem<T>;

/**
 * Return the first available media URL based on the `sort` value.
 * Prefers `signedUrl`, falling back to absolute `url` values.
 */
export function getFirstImage<T extends { url: string | null | undefined; sort?: number | null; signedUrl?: string | null }>(
  mediaItems: Array<T>,
): string | null {
  if (!mediaItems?.length) {
    return null;
  }

  const sorted = [...mediaItems].sort((a, b) => {
    const sortA = typeof a.sort === "number" ? a.sort : 0;
    const sortB = typeof b.sort === "number" ? b.sort : 0;
    return sortA - sortB;
  });

  for (const item of sorted) {
    if (item.signedUrl && item.signedUrl.length > 0) {
      return item.signedUrl;
    }

    const url = item.url ?? null;
    if (url && /^https?:\/\//i.test(url)) {
      return url;
    }
  }

  return null;
}
