import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabaseTypes";

export const runtime = "nodejs";

type AdvertRow = Tables<"adverts">;
type AdvertStatus = NonNullable<AdvertRow["status"]>;
type SpecificsRecord = Record<string, string>;

const ALLOWED_STATUSES: ReadonlySet<AdvertStatus> = new Set(["draft", "active", "archived"]);
const ALLOWED_CONDITIONS = new Set(["new", "used", "for_parts"]);

const trim = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const normalizePrice = (value: unknown): number | null => {
  if (typeof value !== "number") return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
};

const parseSpecifics = (value: unknown): SpecificsRecord | null => {
  if (!value || typeof value !== "object") return null;
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, maybe]) => {
      const sanitizedKey = trim(key);
      const sanitizedValue = trim(typeof maybe === "string" ? maybe : String(maybe ?? ""));
      if (!sanitizedKey || !sanitizedValue) return null;
      return [sanitizedKey, sanitizedValue] as const;
    })
    .filter((item): item is readonly [string, string] => Boolean(item));

  if (!entries.length) {
    return {};
  }
  return Object.fromEntries(entries);
};

const enforceStatusTransition = (current: AdvertStatus, next: AdvertStatus) => {
  if (!ALLOWED_STATUSES.has(next)) {
    return createErrorResponse(ApiErrorCode.INVALID_PAYLOAD, {
      status: 400,
      details: { status: next },
      message: "INVALID_STATUS",
    });
  }

  if (current === next) return null;

  if (current === "draft" && (next === "active" || next === "archived")) return null;
  if (current === "active" && next === "archived") return null;
  if (current === "archived" && next === "active") return null;

  return createErrorResponse(ApiErrorCode.INVALID_PAYLOAD, {
    status: 400,
    details: { from: current, to: next },
    message: "INVALID_TRANSITION",
  });
};

const fetchMediaCount = async (supabase: ReturnType<typeof supabaseServer>, advertId: string) => {
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
      message: "MEDIA_REQUIRED",
    });
  }

  return null;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: advertId } = await context.params;

  if (!advertId) {
    return createErrorResponse(ApiErrorCode.MISSING_ID, { status: 400 });
  }

  const parseResult = await safeJsonParse<Record<string, unknown>>(request);
  if (!parseResult.success) {
    return parseResult.response;
  }
  const body = parseResult.data;

  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTHENTICATED, { status: 401 });
  }

  const { data: advert, error: fetchError } = await supabase
    .from("adverts")
    .select(
      "id,user_id,status,category_id,title,description,price,currency,condition,location",
    )
    .eq("id", advertId)
    .maybeSingle();

  if (fetchError) {
    return handleSupabaseError(fetchError, ApiErrorCode.FETCH_FAILED);
  }

  if (!advert) {
    return createErrorResponse(ApiErrorCode.NOT_FOUND, { status: 404 });
  }

  if (advert.user_id !== user.id) {
    const audit: TablesInsert<"logs"> = {
      user_id: user.id,
      action: "advert_update_denied",
      details: { advertId },
    };
    await supabaseService().from("logs").insert(audit);
    return createErrorResponse(ApiErrorCode.FORBIDDEN, { status: 403 });
  }

  const updates: TablesUpdate<"adverts"> = {};
  const specifics = parseSpecifics((body as Record<string, unknown>).specifics ?? null);

  const title = trim((body as Record<string, unknown>).title);
  if (title !== null) {
    if (title.length < 3) {
      return createErrorResponse(ApiErrorCode.BAD_INPUT, {
        status: 400,
        details: { minLength: 3 },
        message: "INVALID_TITLE",
      });
    }
    updates.title = title;
  }

  const description = trim((body as Record<string, unknown>).description);
  if (description !== null) {
    if (description.length < 10) {
      return createErrorResponse(ApiErrorCode.BAD_INPUT, {
        status: 400,
        details: { minLength: 10 },
        message: "INVALID_DESCRIPTION",
      });
    }
    updates.description = description;
  }

  const price = normalizePrice((body as Record<string, unknown>).price);
  if (price !== null) {
    updates.price = price;
  } else if ((body as Record<string, unknown>).price === null) {
    updates.price = null;
  }

  const location = trim((body as Record<string, unknown>).location);
  if (location !== null) {
    updates.location = location;
  } else if ((body as Record<string, unknown>).location === "") {
    updates.location = null;
  }

  const condition = trim((body as Record<string, unknown>).condition);
  if (condition) {
    if (!ALLOWED_CONDITIONS.has(condition)) {
      return createErrorResponse(ApiErrorCode.BAD_INPUT, {
        status: 400,
        details: { condition },
        message: "INVALID_CONDITION",
      });
    }
    updates.condition = condition as AdvertRow["condition"];
  }

  const categoryId = trim((body as Record<string, unknown>).category_id);
  if (categoryId) {
    updates.category_id = categoryId;
  }

  const requestedStatusRaw = trim((body as Record<string, unknown>).status);
  let requestedStatus: AdvertStatus | null = null;
  if (requestedStatusRaw) {
    requestedStatus = requestedStatusRaw as AdvertStatus;
    const transitionError = enforceStatusTransition(advert.status ?? "draft", requestedStatus);
    if (transitionError) return transitionError;

    if (requestedStatus === "active") {
      const mediaCheckError = await fetchMediaCount(supabase, advertId);
      if (mediaCheckError) return mediaCheckError;
    }

    updates.status = requestedStatus;
  }

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabase
      .from("adverts")
      .update(updates)
      .eq("id", advertId);

    if (updateError) {
      return handleSupabaseError(updateError, ApiErrorCode.UPDATE_FAILED);
    }
  }

  if (specifics) {
    if (Object.keys(specifics).length) {
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
    await supabaseService().from("logs").insert(audit);
  }

  return createSuccessResponse({});
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: advertId } = await context.params;
  if (!advertId) {
    return createErrorResponse(ApiErrorCode.MISSING_ID, { status: 400 });
  }

  const supabase = supabaseServer();
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

  if (advert.user_id !== user.id) {
    const audit: TablesInsert<"logs"> = {
      user_id: user.id,
      action: "advert_delete_denied",
      details: { advertId },
    };
    await supabaseService().from("logs").insert(audit);
    return createErrorResponse(ApiErrorCode.FORBIDDEN, { status: 403 });
  }

  const { data: mediaRows, error: mediaError } = await supabase
    .from("media")
    .select("id,url")
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
      await supabaseService().storage.from("ad-media").remove(storagePaths);
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
  await supabaseService().from("logs").insert(audit);

  return createSuccessResponse({});
}
