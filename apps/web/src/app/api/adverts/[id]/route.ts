import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { revalidateAdvert } from "@/lib/advert/advertDetail";
import { supabaseService } from "@/lib/supabaseService";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { validateRequest } from "@/lib/validations";
import { updateAdvertSchema } from "@/lib/validations/adverts";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabaseTypes";
import { isViewerVerified } from "@/lib/auth/requireVerified";
import { markAdvertTranslationsStale } from "@/lib/translations/advertTranslations";
import { createRateLimiter, getClientIp, build429 } from "@/lib/rateLimiter";
import { assertSameOrigin } from "@/lib/security/csrf";

export const runtime = "nodejs";

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// SEC-RL1: publish is the spam surface, not draft edits — scope the limiter
// to the publish transition only so plain field edits stay unthrottled.
const ADVERT_PUBLISH_USER_ATTEMPTS = parsePositiveInt(
  process.env.RATE_LIMIT_ADVERT_PUBLISH_USER_PER_10M,
  10,
);
const ADVERT_PUBLISH_USER_WINDOW_SEC = 10 * 60;
const ADVERT_PUBLISH_IP_ATTEMPTS = parsePositiveInt(
  process.env.RATE_LIMIT_ADVERT_PUBLISH_IP_PER_24H,
  100,
);
const ADVERT_PUBLISH_IP_WINDOW_SEC = 24 * 60 * 60;

const advertPublishUserLimiter = createRateLimiter({
  limit: ADVERT_PUBLISH_USER_ATTEMPTS,
  windowSec: ADVERT_PUBLISH_USER_WINDOW_SEC,
  prefix: "advert:publish:user",
});

const advertPublishIpLimiter = createRateLimiter({
  limit: ADVERT_PUBLISH_IP_ATTEMPTS,
  windowSec: ADVERT_PUBLISH_IP_WINDOW_SEC,
  prefix: "advert:publish:ip",
  bucketId: "global",
});

type AdvertRow = Tables<"adverts">;
type AdvertStatus = NonNullable<AdvertRow["status"]>;

const ALLOWED_STATUSES: ReadonlySet<AdvertStatus> = new Set(["draft", "active", "archived"]);

type ServiceClientWithRpc = {
  rpc: (
    fn: "resolve_location_id",
    args: { p_location: string },
  ) => Promise<{ data: string | null; error: { message?: string } | null }>;
};

const enforceStatusTransition = (current: AdvertStatus, next: AdvertStatus) => {
  if (!ALLOWED_STATUSES.has(next)) {
    return createErrorResponse(ApiErrorCode.INVALID_PAYLOAD, {
      status: 400,
      detail: `INVALID_STATUS: ${next}`,
    });
  }

  if (current === next) return null;

  if (current === "draft" && (next === "active" || next === "archived")) return null;
  if (current === "active" && next === "archived") return null;
  if (current === "archived" && next === "active") return null;

  return createErrorResponse(ApiErrorCode.INVALID_PAYLOAD, {
    status: 400,
    detail: `INVALID_TRANSITION: ${current} -> ${next}`,
  });
};

const fetchMediaCount = async (
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  advertId: string,
) => {
  const { count, error } = await supabase
    .from("media")
    .select("id", { head: true, count: "exact" })
    .eq("advert_id", advertId);

  if (error) {
    return handleSupabaseError(error, ApiErrorCode.FETCH_FAILED);
  }

  if (!count) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "MEDIA_REQUIRED",
    });
  }

  return null;
};

const resolveLocationId = async (
  service: Awaited<ReturnType<typeof supabaseService>>,
  location: string | null | undefined,
) => {
  const trimmed = location?.trim();
  if (!trimmed) return null;

  const { data, error } = await (service as unknown as ServiceClientWithRpc)
    .rpc("resolve_location_id", { p_location: trimmed });

  if (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[PATCH /api/adverts/:id] resolve_location_id failed", error.message ?? error);
    }
    return undefined;
  }

  return data ?? null;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const { id: advertId } = await context.params;

  if (!advertId) {
    return createErrorResponse(ApiErrorCode.MISSING_ID, { status: 400 });
  }

  const parseResult = await safeJsonParse<Record<string, unknown>>(request);
  if (!parseResult.success) {
    return parseResult.response;
  }

  // Validate request body with Zod schema
  const validationResult = validateRequest(updateAdvertSchema, parseResult.data);
  if (!validationResult.success) {
    return validationResult.response;
  }
  const body = validationResult.data;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTHENTICATED, { status: 401 });
  }

  const { data: advert, error: fetchError } = await supabase
    .from("adverts")
    .select(
      "id,user_id,status,category_id,title,description,price,currency,condition,location,location_id,min_offer_cents,content_locale",
    )
    .eq("id", advertId)
    .maybeSingle();

  if (fetchError) {
    return handleSupabaseError(fetchError, ApiErrorCode.FETCH_FAILED);
  }

  if (!advert) {
    return createErrorResponse(ApiErrorCode.NOT_FOUND, { status: 404 });
  }

  const service = await supabaseService();

  if (advert.user_id !== user.id) {
    const audit: TablesInsert<"logs"> = {
      user_id: user.id,
      action: "advert_update_denied",
      details: { advertId },
    };
    await service.from("logs").insert(audit);
    return createErrorResponse(ApiErrorCode.FORBIDDEN, { status: 403 });
  }

  const updates: TablesUpdate<"adverts"> = {};
  const specifics = body.specifics ?? null;
  const sourceChanged =
    (body.title !== undefined && body.title !== advert.title) ||
    (body.description !== undefined && (body.description ?? null) !== (advert.description ?? null)) ||
    (body.content_locale !== undefined && body.content_locale !== advert.content_locale);

  // Get requested status early to check if we're publishing
  const requestedStatus = body.status;
  const isPublishing = requestedStatus === "active";

  // Publish gate: rate limit + phone verification + fraud block check
  if (isPublishing) {
    const publishUserResult = await advertPublishUserLimiter(user.id);
    if (!publishUserResult.success) {
      return build429(publishUserResult);
    }

    const ip = getClientIp(request);
    if (ip) {
      const publishIpResult = await advertPublishIpLimiter(ip);
      if (!publishIpResult.success) {
        return build429(publishIpResult);
      }
    }

    if (!(await isViewerVerified(supabase, user.id))) {
      return createErrorResponse(ApiErrorCode.VERIFICATION_REQUIRED, {
        status: 403,
        detail: "Phone verification required to publish",
      });
    }

    const { checkUserBlocked } = await import("@/lib/fraud/checkUserBlocked");
    const blockCheck = await checkUserBlocked(user.id, { failClosed: true });
    if (blockCheck.isBlocked) {
      return createErrorResponse(ApiErrorCode.FORBIDDEN, {
        status: 403,
        detail: blockCheck.reason || "Account is temporarily blocked. Cannot publish adverts.",
      });
    }
  }

  if (body.title !== undefined) {
    updates.title = body.title;
  }

  if (body.description !== undefined) {
    // Zod already validates description length when publishing
    updates.description = body.description ?? null;
  }

  if (body.price !== undefined) {
    updates.price = body.price;
  }

  if (body.min_offer_cents !== undefined) {
    updates.min_offer_cents = body.min_offer_cents;
  }

  if (body.location !== undefined) {
    updates.location = body.location;
  }

  if (body.location !== undefined || isPublishing) {
    const locationToResolve = body.location !== undefined ? body.location : advert.location;
    const resolvedLocationId = await resolveLocationId(service, locationToResolve);
    if (resolvedLocationId !== undefined) {
      updates.location_id = resolvedLocationId;
    }
  }

  if (body.condition !== undefined) {
    updates.condition = body.condition;
  }

  if (body.category_id !== undefined) {
    updates.category_id = body.category_id;
  }

  if (body.currency !== undefined) {
    updates.currency = body.currency;
  }

  if (body.content_locale !== undefined) {
    updates.content_locale = body.content_locale;
  }

  if (requestedStatus) {
    const transitionError = enforceStatusTransition(advert.status ?? "draft", requestedStatus);
    if (transitionError) return transitionError;

    if (requestedStatus === "active") {
      const resolvedDescription = body.description ?? advert.description ?? "";
      if (resolvedDescription.trim().length < 10) {
        return createErrorResponse(ApiErrorCode.BAD_INPUT, {
          status: 400,
          detail: "DESCRIPTION_TOO_SHORT",
        });
      }

      const resolvedCategoryId = body.category_id ?? advert.category_id;
      if (!resolvedCategoryId) {
        return createErrorResponse(ApiErrorCode.BAD_INPUT, {
          status: 400,
          detail: "CATEGORY_REQUIRED",
        });
      }

      const resolvedCondition = body.condition ?? advert.condition;
      if (!resolvedCondition) {
        return createErrorResponse(ApiErrorCode.BAD_INPUT, {
          status: 400,
          detail: "CONDITION_REQUIRED",
        });
      }

      const resolvedLocation = body.location ?? advert.location;
      if (!resolvedLocation || resolvedLocation.trim().length === 0) {
        return createErrorResponse(ApiErrorCode.BAD_INPUT, {
          status: 400,
          detail: "LOCATION_REQUIRED",
        });
      }

      const mediaCheckError = await fetchMediaCount(supabase, advertId);
      if (mediaCheckError) return mediaCheckError;
    }

    updates.status = requestedStatus;
  }

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await service
      .from("adverts")
      .update(updates)
      .eq("id", advertId);

    if (updateError) {
      return handleSupabaseError(updateError, ApiErrorCode.UPDATE_FAILED);
    }
  }

  if (sourceChanged) {
    const staleError = await markAdvertTranslationsStale(service, advertId);
    if (staleError) {
      return handleSupabaseError(staleError, ApiErrorCode.UPDATE_FAILED);
    }
  }

  if (specifics !== null && specifics !== undefined) {
    if (Object.keys(specifics).length > 0) {
      const payload: TablesInsert<"ad_item_specifics"> = {
        advert_id: advertId,
        specifics,
      };
      const { error: specificsError } = await supabase
        .from("ad_item_specifics")
        .upsert(payload, { onConflict: "advert_id" });

      if (specificsError) {
        return handleSupabaseError(specificsError, ApiErrorCode.UPDATE_FAILED);
      }

      // F7: propagate generation_id from JSONB specifics to the normalized FK column.
      // The specifics schema is Record<string,string>; we validate UUID format before writing.
      const rawGenId = specifics.generation_id;
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (rawGenId && UUID_RE.test(rawGenId)) {
        await service.from("adverts")
          .update({ generation_id: rawGenId })
          .eq("id", advertId);
      } else if (rawGenId === "" || rawGenId === null) {
        await service.from("adverts")
          .update({ generation_id: null })
          .eq("id", advertId);
      }
    } else {
      const { error: deleteSpecificsError } = await supabase
        .from("ad_item_specifics")
        .delete()
        .eq("advert_id", advertId);

      if (deleteSpecificsError) {
        return handleSupabaseError(deleteSpecificsError, ApiErrorCode.UPDATE_FAILED);
      }
    }
  }

  if (requestedStatus && requestedStatus !== advert.status) {
    const audit: TablesInsert<"logs"> = {
      user_id: user.id,
      action: "advert_status_change",
      details: { advertId, from: advert.status, to: requestedStatus },
    };
    await service.from("logs").insert(audit);
  }

  // On publish: run advert-level fraud rules (price-anomaly, pattern checks) so
  // bait pricing and suspicious listings are flagged/queued-for-review in runtime.
  if (isPublishing) {
    const { invokeFraudCheck } = await import("@/lib/fraud/invokeFraudCheck");
    await invokeFraudCheck({ check_type: "advert", advert_id: advertId });
  }

  // PERF-01: bust the cached /ad/[id] detail so edits/publish reflect at once
  // (otherwise stale up to the revalidate window).
  revalidateAdvert(advertId);

  return createSuccessResponse({});
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: advertId } = await context.params;

  if (!advertId) {
    return createErrorResponse(ApiErrorCode.MISSING_ID, { status: 400 });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(advertId)) {
    return createErrorResponse(ApiErrorCode.NOT_FOUND, { status: 404 });
  }

  // Use service role for public access to avoid RLS issues
  // We'll check status manually to enforce access control
  const supabaseServiceClient = await supabaseService();
  const supabaseUserClient = await supabaseServer();

  // Load advert with specifics - use service role to bypass RLS for public access
  const { data: advert, error: fetchError } = await supabaseServiceClient
    .from("adverts")
    .select(
      "id,user_id,title,description,price,currency,condition,location,created_at,updated_at,status,category_id",
    )
    .eq("id", advertId)
    .maybeSingle();

  if (fetchError) {
    return handleSupabaseError(fetchError, ApiErrorCode.FETCH_FAILED);
  }

  if (!advert) {
    console.log(`Advert not found in database: ${advertId}`);
    return createErrorResponse(ApiErrorCode.NOT_FOUND, { status: 404 });
  }

  console.log(`Found advert ${advertId}: status="${advert.status}", user_id="${advert.user_id}"`);

  // Only allow public access to active adverts
  if (advert.status !== "active") {
    // Check if user is the owner using user client
    const {
      data: { user },
      error: userError,
    } = await supabaseUserClient.auth.getUser();
    
    // If user is not authenticated or is not the owner, deny access
    if (userError || !user || advert.user_id !== user.id) {
      console.log(`Access denied for advert ${advertId}: status=${advert.status}, user=${user?.id}, owner=${advert.user_id}, error=${userError}`);
      return createErrorResponse(ApiErrorCode.NOT_FOUND, { status: 404 });
    }
    
    console.log(`Owner access granted for draft advert ${advertId}`);
  }

  // Load specifics using service role (already have access to advert, so safe)
  const { data: specificsData } = await supabaseServiceClient
    .from("ad_item_specifics")
    .select("specifics")
    .eq("advert_id", advertId)
    .maybeSingle();

  const specifics = specificsData?.specifics || {};

  return createSuccessResponse({
    advert: {
      ...advert,
      specifics,
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const csrfError = assertSameOrigin(_request);
  if (csrfError) return csrfError;

  const { id: advertId } = await context.params;
  if (!advertId) {
    return createErrorResponse(ApiErrorCode.MISSING_ID, { status: 400 });
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTHENTICATED, { status: 401 });
  }

  const { data: advert, error: fetchError } = await supabase
    .from("adverts")
    .select("id,user_id")
    .eq("id", advertId)
    .maybeSingle();

  if (fetchError) {
    return handleSupabaseError(fetchError, ApiErrorCode.FETCH_FAILED);
  }

  if (!advert) {
    return createErrorResponse(ApiErrorCode.NOT_FOUND, { status: 404 });
  }

  const service = await supabaseService();

  if (advert.user_id !== user.id) {
    const audit: TablesInsert<"logs"> = {
      user_id: user.id,
      action: "advert_delete_denied",
      details: { advertId },
    };
    await service.from("logs").insert(audit);
    return createErrorResponse(ApiErrorCode.FORBIDDEN, { status: 403 });
  }

  const { data: mediaRows, error: mediaError } = await supabase
    .from("media")
    .select("id,url,preview_url")
    .eq("advert_id", advertId);

  if (mediaError) {
    return handleSupabaseError(mediaError, ApiErrorCode.FETCH_FAILED);
  }

  const { error: specificsError } = await supabase
    .from("ad_item_specifics")
    .delete()
    .eq("advert_id", advertId);

  if (specificsError) {
    return handleSupabaseError(specificsError, ApiErrorCode.UPDATE_FAILED);
  }

  const { error: mediaDeleteError } = await supabase.from("media").delete().eq("advert_id", advertId);
  if (mediaDeleteError) {
    return handleSupabaseError(mediaDeleteError, ApiErrorCode.UPDATE_FAILED);
  }

  if (mediaRows?.length) {
    const storagePaths = mediaRows
      .map((row) => row.url)
      .filter((path): path is string => Boolean(path && !path.startsWith("http")));
    if (storagePaths.length) {
      await service.storage.from("ad-media").remove(storagePaths);
    }
    const previewStoragePaths = mediaRows
      .map((row) => row.preview_url)
      .filter((path): path is string => Boolean(path && !path.startsWith("http")));
    if (previewStoragePaths.length) {
      await service.storage.from("ad-media-preview").remove(previewStoragePaths);
    }
  }

  const { error: deleteAdvertError } = await supabase.from("adverts").delete().eq("id", advertId);
  if (deleteAdvertError) {
    return handleSupabaseError(deleteAdvertError, ApiErrorCode.UPDATE_FAILED);
  }

  const audit: TablesInsert<"logs"> = {
    user_id: user.id,
    action: "advert_delete",
    details: { advertId },
  };
  await service.from("logs").insert(audit);

  // PERF-01: drop the cached detail for the now-deleted advert.
  revalidateAdvert(advertId);

  return createSuccessResponse({});
}
