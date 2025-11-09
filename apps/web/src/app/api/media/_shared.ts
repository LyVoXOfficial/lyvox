import type { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { supabaseService } from "@/lib/supabaseService";
import {
  createErrorResponse,
  handleSupabaseError,
  ApiErrorCode,
} from "@/lib/apiErrors";
import type { Database, Tables, TablesInsert } from "@/lib/supabaseTypes";

export const MEDIA_LIMIT_PER_ADVERT = 12;

type ServerClient = SupabaseClient<Database>;
type ResponseResult = { response: NextResponse<unknown> };

const unauthenticated = () =>
  createErrorResponse(ApiErrorCode.UNAUTHENTICATED, { status: 401 });

const forbidden = () =>
  createErrorResponse(ApiErrorCode.FORBIDDEN, { status: 403 });

type LogDetails = TablesInsert<"logs">["details"];

export async function requireAuthenticatedUser(
  supabase: ServerClient,
): Promise<{ user: User } | ResponseResult> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return { response: handleSupabaseError(error, ApiErrorCode.INTERNAL_ERROR) };
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
    return { response: handleSupabaseError(error, ApiErrorCode.FETCH_FAILED) };
  }

  if (!advert) {
    return { response: createErrorResponse(ApiErrorCode.NOT_FOUND, { status: 404 }) };
  }

  // Type assertion is safe because we ensure id, user_id, and status are selected
  const advertRecord = advert as unknown as AdvertRecord;
  if (advertRecord.user_id !== userId) {
    if (denyLogAction) {
      const logDetails: LogDetails = {
        ...(typeof denyLogDetails === "object" && denyLogDetails !== null ? denyLogDetails : {}),
        advertId,
      } as LogDetails;
      await logMediaEvent(denyLogAction, userId, logDetails);
    }
    return { response: forbidden() };
  }

  return { advert: advertRecord };
}

export async function logMediaEvent(action: string, userId: string, details: LogDetails): Promise<void> {
  try {
    const service = await supabaseService();
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
