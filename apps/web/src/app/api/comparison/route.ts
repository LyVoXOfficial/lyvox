import { NextRequest } from "next/server";
import { z } from "zod";

import { supabaseServer } from "@/lib/supabaseServer";
import {
  ApiErrorCode,
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
} from "@/lib/apiErrors";
import { signMediaUrls } from "@/lib/media/signMediaUrls";
import { getFirstImage } from "@/lib/media/getFirstImage";

function normalizeCondition(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/[_\s]+/g, "-");

  const mapping: Record<string, string> = {
    "brand-new": "new",
    new: "new",
    "like-new": "like-new",
    "like-new-condition": "like-new",
    excellent: "excellent",
    "very-good": "excellent",
    "very-good-condition": "excellent",
    good: "good",
    "good-condition": "good",
    fair: "fair",
    acceptable: "fair",
    used: "used",
    "pre-owned": "used",
    damaged: "damaged",
    broken: "damaged",
    "for-parts": "damaged",
  };

  return mapping[normalized] ?? normalized;
}

const payloadSchema = z.object({
  advertIds: z.array(z.string().uuid()).min(2, "at least two adverts").max(4, "maximum four adverts"),
});

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: issue?.message ?? "Validation failed",
    });
  }

  const { advertIds } = parsed.data;
  const uniqueIds = Array.from(new Set(advertIds));

  if (uniqueIds.length !== advertIds.length) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "Duplicate advert ids are not allowed",
    });
  }

  const { data: advertsData, error: advertsError } = await supabase
    .from("adverts")
    .select(
      `
      id,
      title,
      price,
      currency,
      location,
      status,
      created_at,
      user_id,
      category_id,
      specifics,
      category:category_id (
        id,
        name_en,
        name_ru,
        name_nl,
        name_fr,
        slug
      )
    `,
    )
    .in("id", uniqueIds);

  if (advertsError) {
    return handleSupabaseError(advertsError, ApiErrorCode.FETCH_FAILED);
  }

  const filteredAdverts = (advertsData ?? []).filter((advert) => advert.status === "active");

  if (filteredAdverts.length < 2) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "Only active adverts can be compared",
    });
  }

  const sellerIds = filteredAdverts
    .map((advert) => advert.user_id ?? null)
    .filter((value): value is string => typeof value === "string");

  const { data: trustRows } = await supabase
    .from("trust_score")
    .select("user_id, score")
    .in("user_id", sellerIds);

  const trustMap = new Map<string, number>();
  for (const row of trustRows ?? []) {
    trustMap.set(row.user_id, typeof row.score === "number" ? row.score : Number(row.score) || 0);
  }

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, verified_email, verified_phone")
    .in("id", sellerIds);

  const verifiedMap = new Map<string, boolean>();
  for (const row of profileRows ?? []) {
    verifiedMap.set(
      row.id,
      Boolean(row.verified_email) && Boolean(row.verified_phone),
    );
  }

  const advertIdList = filteredAdverts.map((advert) => advert.id);
  const { data: mediaRows, error: mediaError } = await supabase
    .from("media")
    .select("advert_id, url, sort")
    .in("advert_id", advertIdList)
    .order("sort", { ascending: true });

  if (mediaError) {
    return handleSupabaseError(mediaError, ApiErrorCode.FETCH_FAILED);
  }

  const mediaMap = new Map<string, string>();
  if (mediaRows?.length) {
    const signedMedia = await signMediaUrls(mediaRows);
    const grouped = signedMedia.reduce(
      (acc, media) => {
        if (!acc.has(media.advert_id)) {
          acc.set(media.advert_id, []);
        }
        acc.get(media.advert_id)!.push({
          advert_id: media.advert_id,
          url: media.url ?? null,
          signedUrl: media.signedUrl,
          sort: media.sort ?? null,
        });
        return acc;
      },
      new Map<string, Array<{ advert_id: string; url: string | null; signedUrl: string | null; sort: number | null }>>(),
    );

    for (const [advertId, items] of grouped.entries()) {
      const first = getFirstImage(items);
      if (first) {
        mediaMap.set(advertId, first);
      }
    }
  }

  const comparableById = new Map(
    filteredAdverts.map((advert) => {
      const category = advert.category as
        | {
            name_en?: string | null;
            name_ru?: string | null;
            name_nl?: string | null;
            name_fr?: string | null;
            slug?: string | null;
          }
        | null
        | undefined;

      const categoryName =
        category?.name_en ??
        category?.name_ru ??
        category?.name_nl ??
        category?.name_fr ??
        category?.slug ??
        null;

      const specifics = (advert.specifics as Record<string, unknown> | null) ?? {};
      const conditionValue =
        normalizeCondition(specifics.condition) ??
        normalizeCondition(specifics.state) ??
        null;

      return [
        advert.id,
        {
          id: advert.id,
          title: advert.title ?? "",
          price:
            typeof advert.price === "number"
              ? advert.price
              : advert.price
                ? Number(advert.price)
                : null,
          currency: advert.currency ?? null,
          location: advert.location ?? null,
          categoryId: advert.category_id ?? null,
          categoryName,
          condition: conditionValue,
          image: mediaMap.get(advert.id) ?? null,
          createdAt: advert.created_at ?? null,
          sellerVerified: verifiedMap.get(advert.user_id ?? "") ?? false,
          sellerTrustScore: trustMap.get(advert.user_id ?? "") ?? 0,
          specifics,
        },
      ];
    }),
  );

  const comparableAdverts = uniqueIds
    .map((id) => comparableById.get(id))
    .filter((value): value is NonNullable<typeof value> => Boolean(value));

  if (comparableAdverts.length < 2) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "Unable to load enough adverts for comparison",
    });
  }

  return createSuccessResponse({ adverts: comparableAdverts });
}
