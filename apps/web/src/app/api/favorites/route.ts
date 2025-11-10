import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { signMediaUrls } from "@/lib/media/signMediaUrls";
import {
  createSuccessResponse,
  createErrorResponse,
  handleSupabaseError,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";
import type { Tables } from "@/lib/supabaseTypes";

const addFavoriteSchema = z.object({
  advert_id: z.string().uuid(),
});

type SupabaseServerClient = Awaited<ReturnType<typeof supabaseServer>>;
type SupabaseUser = Awaited<ReturnType<SupabaseServerClient["auth"]["getUser"]>>["data"]["user"];

type FavoriteRow = {
  advert_id: string;
  created_at: string;
  adverts: Pick<
    Tables<"adverts">,
    "id" | "title" | "price" | "currency" | "location" | "status" | "created_at" | "user_id"
  > | null;
};

const contextCache = new WeakMap<Request, Promise<{ supabase: SupabaseServerClient; user: SupabaseUser }>>();

const getRequestContext = async (req: Request) => {
  let cached = contextCache.get(req);
  if (!cached) {
    cached = (async () => {
      const supabase = await supabaseServer();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return { supabase, user: user ?? null };
    })();
    contextCache.set(req, cached);
  }
  return cached;
};

const resolveUserId = (req: Request) => getRequestContext(req).then(({ user }) => user?.id ?? null);

const favoritesGetLimiter = createRateLimiter({
  limit: 60,
  windowSec: 60,
  prefix: "favorites:get",
});

const favoritesPostLimiter = createRateLimiter({
  limit: 30,
  windowSec: 60,
  prefix: "favorites:post",
});

const buildRateLimitKey = (_req: Request, userId: string | null, ip: string | null) =>
  userId ?? ip ?? "anonymous";

async function getFavorites(request: Request) {
  const { supabase, user } = await getRequestContext(request);

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, {
      status: 401,
      detail: "Authentication required",
    });
  }

  const url = new URL(request.url);
  const page = Number.parseInt(url.searchParams.get("page") ?? "0", 10);
  const limit = Math.min(Number.parseInt(url.searchParams.get("limit") ?? "24", 10), 100);
  const offset = page * limit;

  const { data: favoritesData, error: favoritesError } = await supabase
    .from("favorites")
    .select(
      `
      advert_id,
      created_at,
      adverts:advert_id (
        id,
        title,
        price,
        currency,
        location,
        status,
        created_at,
        user_id
      )
    `,
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (favoritesError) {
    return handleSupabaseError(favoritesError, ApiErrorCode.FETCH_FAILED);
  }

  const favorites = (favoritesData ?? []) as FavoriteRow[];

  const { count, error: countError } = await supabase
    .from("favorites")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (countError) {
    return handleSupabaseError(countError, ApiErrorCode.FETCH_FAILED);
  }

  const advertIds = favorites
    .map((favorite) => favorite.adverts?.id ?? null)
    .filter((value): value is string => typeof value === "string");

  const sellerIds = favorites
    .map((favorite) => favorite.adverts?.user_id ?? null)
    .filter((value): value is string => typeof value === "string");

  const mediaMap = new Map<string, string>();
  if (advertIds.length > 0) {
    const { data: mediaData, error: mediaError } = await supabase
      .from("media")
      .select("advert_id, url, sort")
      .in("advert_id", advertIds)
      .order("sort", { ascending: true });

    if (mediaError) {
      return handleSupabaseError(mediaError, ApiErrorCode.FETCH_FAILED);
    }

    const signedMedia = await signMediaUrls(mediaData ?? []);

    for (const media of signedMedia) {
      if (media.signedUrl && !mediaMap.has(media.advert_id)) {
        mediaMap.set(media.advert_id, media.signedUrl);
      }
    }
  }

  const sellerVerifiedMap = new Map<string, boolean>();
  if (sellerIds.length > 0) {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, verified_email, verified_phone")
      .in("id", sellerIds);

    if (profileError) {
      return handleSupabaseError(profileError, ApiErrorCode.FETCH_FAILED);
    }

    for (const profile of profileData ?? []) {
      sellerVerifiedMap.set(
        profile.id,
        Boolean(profile.verified_email) && Boolean(profile.verified_phone),
      );
    }
  }

  const items = favorites.map((favorite) => {
    const advert = favorite.adverts;
    const advertId = advert?.id ?? favorite.advert_id;
    return {
      advert_id: favorite.advert_id,
      favorited_at: favorite.created_at,
      advert: advert
        ? {
            ...advert,
            image: mediaMap.get(advertId) ?? null,
            seller_verified: sellerVerifiedMap.get(advert.user_id ?? "") ?? false,
          }
        : null,
    };
  });

  return createSuccessResponse({
    items,
    total: count ?? 0,
    page,
    limit,
    hasMore: (count ?? 0) > offset + items.length,
  });
}

async function addFavorite(request: Request) {
  const { supabase, user } = await getRequestContext(request);

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, {
      status: 401,
      detail: "Authentication required",
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse(ApiErrorCode.INVALID_JSON, {
      status: 400,
      detail: "Invalid JSON body",
    });
  }

  const validation = addFavoriteSchema.safeParse(body);
  if (!validation.success) {
    const firstIssue = validation.error.issues[0];
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: firstIssue?.message ?? "Validation failed",
    });
  }

  const { advert_id } = validation.data;

  const { data: advert, error: advertError } = await supabase
    .from("adverts")
    .select("id, status")
    .eq("id", advert_id)
    .maybeSingle();

  if (advertError || !advert) {
    return createErrorResponse(ApiErrorCode.NOT_FOUND, {
      status: 404,
      detail: "Advert not found",
    });
  }

  if (advert.status !== "active") {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "Cannot favorite inactive advert",
    });
  }

  const { error: insertError } = await supabase.from("favorites").insert({
    user_id: user.id,
    advert_id,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return createSuccessResponse({
        message: "Already in favorites",
        advert_id,
      });
    }

    return handleSupabaseError(insertError, ApiErrorCode.INTERNAL_ERROR);
  }

  return createSuccessResponse(
    {
      message: "Added to favorites",
      advert_id,
    },
    201,
  );
}

export const GET = withRateLimit(getFavorites, {
  limiter: favoritesGetLimiter,
  getUserId: resolveUserId,
  makeKey: buildRateLimitKey,
});

export const POST = withRateLimit(addFavorite, {
  limiter: favoritesPostLimiter,
  getUserId: resolveUserId,
  makeKey: buildRateLimitKey,
});

