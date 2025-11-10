import { supabaseService } from "@/lib/supabaseService";
import { logger } from "@/lib/errorLogger";

export type MediaItemWithUrl<T> = T & { url: string | null | undefined };

export type SignedMediaItem<T> = MediaItemWithUrl<T> & {
  signedUrl: string | null;
};

const HTTP_URL_REGEX = /^https?:\/\//i;
const DEFAULT_TTL_SECONDS = 15 * 60; // 15 minutes
const CACHE_STALE_BUFFER_SECONDS = 30;
const CACHE_MAX_ENTRIES = 5_000;
// The in-memory cache keeps a small window of signed URLs to avoid redundant storage calls between revalidations.

type CacheEntry = {
  signedUrl: string | null;
  expiresAt: number;
};

const signedUrlMemoryCache = new Map<string, CacheEntry>();

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

  const BATCH_SIZE = 50;
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

  const pathsToSign: string[] = [];

  if (bucket) {
    for (const item of mediaItems) {
      const originalUrl = item?.url ?? null;
      if (!originalUrl || HTTP_URL_REGEX.test(originalUrl) || cache.has(originalUrl)) {
        continue;
      }

      const cachedEntry = signedUrlMemoryCache.get(originalUrl);
      if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
        cache.set(originalUrl, cachedEntry.signedUrl);
        continue;
      }

      if (cachedEntry) {
        signedUrlMemoryCache.delete(originalUrl);
      }

      cache.set(originalUrl, null);
      pathsToSign.push(originalUrl);
    }

    for (let index = 0; index < pathsToSign.length; index += BATCH_SIZE) {
      const batch = pathsToSign.slice(index, index + BATCH_SIZE);
      try {
        const { data, error } = await bucket!.createSignedUrls(batch, ttlSeconds);

        if (error || !data?.length) {
          logger.warn("signMediaUrls: failed to create signed URLs batch", {
            component: "signMediaUrls",
            action: "createSignedUrls",
            metadata: { batchSize: batch.length },
            error,
          });
          for (const path of batch) {
            cache.set(path, null);
          }
          continue;
        }

        for (let i = 0; i < batch.length; i++) {
          const path = batch[i];
          const item = data[i];

          if (!item?.signedUrl) {
            logger.warn("signMediaUrls: missing signed URL in batch result", {
              component: "signMediaUrls",
              action: "createSignedUrls:item",
              metadata: { path, index: i },
            });
            cache.set(path, null);
            continue;
          }

          cache.set(path, item.signedUrl);
          const expiresAt =
            Date.now() + Math.max(0, ttlSeconds - CACHE_STALE_BUFFER_SECONDS) * 1000;
          signedUrlMemoryCache.set(path, { signedUrl: item.signedUrl, expiresAt });

          if (signedUrlMemoryCache.size > CACHE_MAX_ENTRIES) {
            const firstKey = signedUrlMemoryCache.keys().next().value as string | undefined;
            if (firstKey) {
              signedUrlMemoryCache.delete(firstKey);
            }
          }
        }
      } catch (error) {
        logger.warn("signMediaUrls: unexpected batch signing error", {
          component: "signMediaUrls",
          action: "createSignedUrls",
          metadata: { batchSize: batch.length },
          error,
        });
        for (const path of batch) {
          cache.set(path, null);
        }
      }
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

    let signedUrl = cache.get(originalUrl) ?? null;

    if (!cache.has(originalUrl)) {
      const cachedEntry = signedUrlMemoryCache.get(originalUrl);
      if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
        signedUrl = cachedEntry.signedUrl;
      } else if (cachedEntry) {
        signedUrlMemoryCache.delete(originalUrl);
      }
    }

    results.push({ ...item, signedUrl });
  }

  return results;
}
