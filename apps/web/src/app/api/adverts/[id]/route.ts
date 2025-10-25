import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import { VEHICLE_DATA, CURRENT_YEAR } from "@/data/vehicles";

export const runtime = "nodejs";

type VehicleInput = {
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  condition?: string;
};

type ValidationResult =
  | { valid: true; specifics: Record<string, unknown> | null; condition: string | null }
  | { valid: false; details: Record<string, unknown> };

const TRANSPORT_PATH_SEGMENT = "transport/legkovye-avtomobili";
const ALLOWED_STATUSES = new Set(["draft", "active", "archived"]);
const CONDITION_VALUES = new Set(["new", "excellent", "good", "needs_repair"]);
const MAX_MILEAGE_KM = 2_000_000;

const trimString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const normalizeFiniteNumber = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
};

const validateVehicleData = (input: VehicleInput, categoryPath: string): ValidationResult => {
  const isTransport = categoryPath.includes(TRANSPORT_PATH_SEGMENT);
  const hasVehiclePayload = input && Object.values(input).some((value) => value !== undefined);

  if (!isTransport) {
    if (hasVehiclePayload) {
      return {
        valid: true,
        specifics: null,
        condition: null,
      };
    }
    return { valid: true, specifics: null, condition: null };
  }

  const make = trimString(input.make);
  const model = trimString(input.model);
  const yearValue = normalizeFiniteNumber(input.year);
  const mileageValue = normalizeFiniteNumber(input.mileage);
  const condition = trimString(input.condition);

  const details: Record<string, unknown> = {};

  if (!make) details.make = "required";
  if (!model) details.model = "required";
  if (yearValue === null) details.year = "required";
  if (mileageValue === null) details.mileage = "required";
  if (!condition || !CONDITION_VALUES.has(condition)) details.condition = "invalid";

  if (Object.keys(details).length) {
    return { valid: false, details };
  }

  const models = VEHICLE_DATA[make];
  if (!models) {
    return { valid: false, details: { make: "unknown" } };
  }

  const matchedModel = models.find((item) => item.name === model);
  if (!matchedModel) {
    return { valid: false, details: { model: "unknown" } };
  }

  const minYear = matchedModel.yearStart;
  const maxYear = matchedModel.yearEnd ?? CURRENT_YEAR;

  if (yearValue! < minYear || yearValue! > maxYear) {
    return {
      valid: false,
      details: { year: `allowed range ${minYear}-${maxYear}` },
    };
  }

  if (mileageValue! < 0 || mileageValue! > MAX_MILEAGE_KM) {
    return {
      valid: false,
      details: { mileage: `must be between 0 and ${MAX_MILEAGE_KM}` },
    };
  }

  return {
    valid: true,
    condition,
    specifics: {
      vehicle_make: make,
      vehicle_model: model,
      vehicle_year: yearValue,
      vehicle_mileage_km: Math.round(mileageValue!),
      vehicle_body_type: matchedModel.bodyType,
      vehicle_country: matchedModel.country,
    },
  };
};

const enforceStatusTransition = (currentStatus: string, nextStatus: string) => {
  if (!ALLOWED_STATUSES.has(nextStatus)) {
    throw NextResponse.json(
      { error: "invalid_status", details: { status: nextStatus } },
      { status: 400 },
    );
  }

  if (nextStatus === "blocked") {
    throw NextResponse.json({ error: "forbidden_status" }, { status: 403 });
  }

  if (currentStatus === "draft") {
    return;
  }

  if (currentStatus === "active" && nextStatus === "draft") {
    throw NextResponse.json({ error: "invalid_transition" }, { status: 400 });
  }

  if (currentStatus === "archived" && nextStatus === "draft") {
    throw NextResponse.json({ error: "invalid_transition" }, { status: 400 });
  }
};

const ensureMediaForPublication = async (advertId: string, supabase: ReturnType<typeof supabaseServer>) => {
  const { count, error } = await supabase
    .from("media")
    .select("id", { count: "exact", head: true })
    .eq("advert_id", advertId);
  if (error) {
    throw NextResponse.json({ error: "media_check_failed", details: error.message }, { status: 400 });
  }
  if (!count || count <= 0) {
    throw NextResponse.json({ error: "media_required" }, { status: 400 });
  }
};

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: advertId } = await context.params;

  if (!advertId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data: advert, error: advertError } = await supabase
    .from("adverts")
    .select("id,user_id,status,category_id,title,description,price,location,condition")
    .eq("id", advertId)
    .maybeSingle();

  if (advertError) {
    return NextResponse.json({ error: "fetch_failed", details: advertError.message }, { status: 400 });
  }

  if (!advert) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (advert.user_id !== user.id) {
    // SECURITY: log denied attempt to update advert not owned by requester
    await supabaseService()
      .from("logs")
      .insert({
        user_id: user.id,
        action: "advert_update_denied",
        details: { advertId },
      });
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const title = trimString(body.title) ?? advert.title ?? "Черновик объявления";
  if (title.length < 3) {
    return NextResponse.json(
      { error: "invalid_vehicle_data", details: { title: "min_length_3" } },
      { status: 400 },
    );
  }

  const description = trimString(body.description);
  const location = trimString(body.location);

  const priceRaw = body.price;
  const price =
    priceRaw === null || priceRaw === undefined
      ? null
      : Number.isFinite(priceRaw) && priceRaw >= 0
        ? priceRaw
        : NaN;
  if (Number.isNaN(price)) {
    return NextResponse.json(
      { error: "invalid_vehicle_data", details: { price: "must_be_positive_number" } },
      { status: 400 },
    );
  }

  const categoryId = trimString(body.category_id) ?? advert.category_id;

  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id,path")
    .eq("id", categoryId)
    .maybeSingle();

  if (categoryError || !category) {
    return NextResponse.json(
      { error: "invalid_vehicle_data", details: { category_id: "not_found" } },
      { status: 400 },
    );
  }

  const vehicleInput: VehicleInput = body.vehicle ?? {};
  const vehicleValidation = validateVehicleData(vehicleInput, category.path ?? "");
  // SECURITY: enforce vehicle-specific fields server-side
  if (!vehicleValidation.valid) {
    return NextResponse.json(
      { error: "invalid_vehicle_data", details: vehicleValidation.details },
      { status: 400 },
    );
  }

  const requestedStatus = trimString(body.status) ?? advert.status;
  enforceStatusTransition(advert.status ?? "draft", requestedStatus);

  if (requestedStatus === "active") {
    // SECURITY: publishing requires at least one media asset
    await ensureMediaForPublication(advertId, supabase);
  }

  const updatePayload: Record<string, unknown> = {
    title,
    description,
    price: price ?? null,
    location,
    category_id: categoryId,
    status: requestedStatus,
    condition: vehicleValidation.condition,
  };

  const { error: updateError } = await supabase
    .from("adverts")
    .update(updatePayload)
    .eq("id", advertId);

  if (updateError) {
    return NextResponse.json(
      { error: "update_failed", details: updateError.message },
      { status: 400 },
    );
  }

  if (vehicleValidation.specifics) {
    await supabase
      .from("ad_item_specifics")
      .upsert({
        advert_id: advertId,
        specifics: vehicleValidation.specifics,
      });
  } else {
    await supabase.from("ad_item_specifics").delete().eq("advert_id", advertId);
  }

  if (requestedStatus !== advert.status) {
    await supabaseService()
      .from("logs")
      .insert({
        user_id: user.id,
        action: "advert_status_change",
        details: { advertId, from: advert.status, to: requestedStatus },
      });
  }

  return NextResponse.json({
    ok: true,
    advert: {
      id: advertId,
      status: requestedStatus,
      category_id: categoryId,
      condition: vehicleValidation.condition,
    },
  });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
    await supabaseService()
      .from("logs")
      .insert({
        user_id: user.id,
        action: "advert_delete_denied",
        details: { advertId },
      });
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const { data: mediaRows } = await supabase
    .from("media")
    .select("url")
    .eq("advert_id", advertId);

  const deleteSpecifics = await supabase
    .from("ad_item_specifics")
    .delete()
    .eq("advert_id", advertId);

  if (deleteSpecifics.error) {
    return NextResponse.json(
      { ok: false, error: deleteSpecifics.error.message },
      { status: 400 },
    );
  }

  const deleteMedia = await supabase.from("media").delete().eq("advert_id", advertId);

  if (deleteMedia.error) {
    return NextResponse.json(
      { ok: false, error: deleteMedia.error.message },
      { status: 400 },
    );
  }

  if (mediaRows?.length) {
    const storagePaths = mediaRows
      .map((row) => row.url)
      .filter((path) => path && !path.startsWith("http"));
    if (storagePaths.length) {
      await supabaseService().storage.from("ad-media").remove(storagePaths);
    }
  }

  const { error: deleteAdvertError } = await supabase.from("adverts").delete().eq("id", advertId);

  if (deleteAdvertError) {
    return NextResponse.json(
      { ok: false, error: deleteAdvertError.message },
      { status: 400 },
    );
  }

  await supabaseService()
    .from("logs")
    .insert({
      user_id: user.id,
      action: "advert_delete",
      details: { advertId },
    });

  return NextResponse.json({ ok: true });
}
