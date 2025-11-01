import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { supabaseService } from "@/lib/supabaseService";
import type { Database, Tables, TablesInsert } from "@/lib/supabaseTypes";

export const MEDIA_LIMIT_PER_ADVERT = 12;

type ServerClient = SupabaseClient<Database>;
type ResponseResult = { response: NextResponse };

const unauthenticated = () =>
  NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

const forbidden = () => NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

type LogDetails = TablesInsert<"logs">["details"];

export async function requireAuthenticatedUser(
  supabase: ServerClient,
): Promise<{ user: User } | ResponseResult> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return { response: NextResponse.json({ ok: false, error: error.message }, { status: 400 }) };
  }

  if (!user) {
    return { response: unauthenticated() };
  }

  return { user };
}

type EnsureAdvertOwnershipParams = {
  supabase: ServerClient;
  advertId: string;
  userId: string;
  select?: string;
  denyLogAction?: string;
  denyLogDetails?: LogDetails;
};

type AdvertRecord = Pick<Tables<"adverts">, "id" | "user_id" | "status"> & Record<string, unknown>;

export async function ensureAdvertOwnership({
  supabase,
  advertId,
  userId,
  select,
  denyLogAction,
  denyLogDetails,
}: EnsureAdvertOwnershipParams): Promise<{ advert: AdvertRecord } | ResponseResult> {
  const baseColumns = select ? select.split(",").map((column) => column.trim()).filter(Boolean) : [];
  if (!baseColumns.includes("user_id")) {
    baseColumns.push("user_id");
  }
  if (!baseColumns.includes("id")) {
    baseColumns.push("id");
  }
  if (!baseColumns.includes("status")) {
    baseColumns.push("status");
  }
  const columns = baseColumns.join(",");

  const { data: advert, error } = await supabase
    .from("adverts")
    .select(columns)
    .eq("id", advertId)
    .maybeSingle();

  if (error) {
    return { response: NextResponse.json({ ok: false, error: error.message }, { status: 400 }) };
  }

  if (!advert) {
    return { response: NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 }) };
  }

  if (advert.user_id !== userId) {
    if (denyLogAction) {
      await logMediaEvent(denyLogAction, userId, {
        advertId,
        ...(denyLogDetails ?? {}),
      });
    }
    return { response: forbidden() };
  }

  return { advert: advert as AdvertRecord };
}

export async function logMediaEvent(action: string, userId: string, details: LogDetails): Promise<void> {
  try {
    const service = supabaseService();
    await service.from("logs").insert({
      user_id: userId,
      action,
      details,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(`[media] failed to log action "${action}"`, error);
    }
  }
}
