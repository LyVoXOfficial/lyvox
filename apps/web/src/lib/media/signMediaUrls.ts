import { supabaseService } from "@/lib/supabaseService";
import { logger } from "@/lib/errorLogger";

export type MediaItemWithUrl<T> = T & { url: string | null | undefined };

export type SignedMediaItem<T> = MediaItemWithUrl<T> & {
  signedUrl: string | null;
};

const HTTP_URL_REGEX = /^https?:\/\//i;
const DEFAULT_TTL_SECONDS = 15 * 60; // 15 minutes

/**
 * Generate signed URLs for media objects stored in the `ad-media` bucket.
 * Absolute URLs are returned as-is.
 */
export async function signMediaUrls<T extends { url: string | null | undefined }>(
  mediaItems: T[],
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<Array<SignedMediaItem<T>>> {
  if (!mediaItems?.length) {
    return [];
  }

  const results: Array<SignedMediaItem<T>> = [];
  const cache = new Map<string, string | null>();

  let bucket: ReturnType<Awaited<ReturnType<typeof supabaseService>>["storage"]["from"]> | null = null;
  const requiresSigning = mediaItems.some((item) => {
    const url = item?.url ?? "";
    return Boolean(url) && !HTTP_URL_REGEX.test(url);
  });

  if (requiresSigning) {
    try {
      const serviceClient = await supabaseService();
      bucket = serviceClient.storage.from("ad-media");
    } catch (error) {
      logger.error("signMediaUrls: failed to get Supabase service client", {
        component: "signMediaUrls",
        action: "supabaseService",
        error,
      });
    }
  }

  for (const item of mediaItems) {
    const originalUrl = item?.url ?? null;

    if (!originalUrl) {
      results.push({ ...item, signedUrl: null });
      continue;
    }

    if (HTTP_URL_REGEX.test(originalUrl)) {
      results.push({ ...item, signedUrl: originalUrl });
      continue;
    }

    if (!bucket) {
      results.push({ ...item, signedUrl: null });
      continue;
    }

    if (cache.has(originalUrl)) {
      results.push({ ...item, signedUrl: cache.get(originalUrl) ?? null });
      continue;
    }

    try {
      const { data, error } = await bucket.createSignedUrl(originalUrl, ttlSeconds);

      if (error || !data?.signedUrl) {
        logger.warn("signMediaUrls: failed to create signed URL", {
          component: "signMediaUrls",
          action: "createSignedUrl",
          metadata: { path: originalUrl },
          error,
        });
        cache.set(originalUrl, null);
        results.push({ ...item, signedUrl: null });
        continue;
      }

      cache.set(originalUrl, data.signedUrl);
      results.push({ ...item, signedUrl: data.signedUrl });
    } catch (error) {
      logger.warn("signMediaUrls: unexpected error while signing URL", {
        component: "signMediaUrls",
        action: "createSignedUrl",
        metadata: { path: originalUrl },
        error,
      });
      cache.set(originalUrl, null);
      results.push({ ...item, signedUrl: null });
    }
  }

  return results;
}
