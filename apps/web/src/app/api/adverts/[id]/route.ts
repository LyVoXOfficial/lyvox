import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
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
    return NextResponse.json({ error: "INVALID_STATUS", details: { status: next } }, { status: 400 });
  }

  if (current === next) return null;

  if (current === "draft" && (next === "active" || next === "archived")) return null;
  if (current === "active" && next === "archived") return null;
  if (current === "archived" && next === "active") return null;

  return NextResponse.json(
    { error: "INVALID_TRANSITION", details: { from: current, to: next } },
    { status: 400 },
  );
};

const fetchMediaCount = async (supabase: ReturnType<typeof supabaseServer>, advertId: string) => {
  const { count, error } = await supabase
    .from("media")
    .select("id", { head: true, count: "exact" })
    .eq("advert_id", advertId);

  if (error) {
    return NextResponse.json(
      { error: "MEDIA_CHECK_FAILED", message: error.message },
      { status: 400 },
    );
  }

  if (!count) {
    return NextResponse.json({ error: "MEDIA_REQUIRED" }, { status: 400 });
  }

  return null;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: advertId } = await context.params;

  if (!advertId) {
    return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { data: advert, error: fetchError } = await supabase
    .from("adverts")
    .select(
      "id,user_id,status,category_id,title,description,price,currency,condition,location",
    )
    .eq("id", advertId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: "FETCH_FAILED", message: fetchError.message }, { status: 400 });
  }

  if (!advert) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  if (advert.user_id !== user.id) {
    const audit: TablesInsert<"logs"> = {
      user_id: user.id,
      action: "advert_update_denied",
      details: { advertId },
    };
    await supabaseService().from("logs").insert(audit);
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const updates: TablesUpdate<"adverts"> = {};
  const specifics = parseSpecifics((body as Record<string, unknown>).specifics ?? null);

  const title = trim((body as Record<string, unknown>).title);
  if (title !== null) {
    if (title.length < 3) {
      return NextResponse.json(
        { error: "INVALID_TITLE", details: { minLength: 3 } },
        { status: 400 },
      );
    }
    updates.title = title;
  }

  const description = trim((body as Record<string, unknown>).description);
  if (description !== null) {
    if (description.length < 10) {
      return NextResponse.json(
        { error: "INVALID_DESCRIPTION", details: { minLength: 10 } },
        { status: 400 },
      );
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
      return NextResponse.json(
        { error: "INVALID_CONDITION", details: { condition } },
        { status: 400 },
      );
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
      return NextResponse.json(
        { error: "UPDATE_FAILED", message: updateError.message },
        { status: 400 },
      );
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
        return NextResponse.json(
          { error: "SPECIFICS_FAILED", message: specificsError.message },
          { status: 400 },
        );
      }
    } else {
      const { error: deleteSpecificsError } = await supabase
        .from("ad_item_specifics")
        .delete()
        .eq("advert_id", advertId);

      if (deleteSpecificsError) {
        return NextResponse.json(
          { error: "SPECIFICS_DELETE_FAILED", message: deleteSpecificsError.message },
          { status: 400 },
        );
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

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: advertId } = await context.params;
  if (!advertId) {
    return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { data: advert, error: fetchError } = await supabase
    .from("adverts")
    .select("id,user_id")
    .eq("id", advertId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ ok: false, error: fetchError.message }, { status: 400 });
  }

  if (!advert) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  if (advert.user_id !== user.id) {
    const audit: TablesInsert<"logs"> = {
      user_id: user.id,
      action: "advert_delete_denied",
      details: { advertId },
    };
    await supabaseService().from("logs").insert(audit);
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const { data: mediaRows, error: mediaError } = await supabase
    .from("media")
    .select("id,url")
    .eq("advert_id", advertId);

  if (mediaError) {
    return NextResponse.json({ ok: false, error: mediaError.message }, { status: 400 });
  }

  const { error: specificsError } = await supabase
    .from("ad_item_specifics")
    .delete()
    .eq("advert_id", advertId);

  if (specificsError) {
    return NextResponse.json({ ok: false, error: specificsError.message }, { status: 400 });
  }

  const { error: mediaDeleteError } = await supabase.from("media").delete().eq("advert_id", advertId);
  if (mediaDeleteError) {
    return NextResponse.json({ ok: false, error: mediaDeleteError.message }, { status: 400 });
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
    return NextResponse.json({ ok: false, error: deleteAdvertError.message }, { status: 400 });
  }

  const audit: TablesInsert<"logs"> = {
    user_id: user.id,
    action: "advert_delete",
    details: { advertId },
  };
  await supabaseService().from("logs").insert(audit);

  return NextResponse.json({ ok: true });
}
