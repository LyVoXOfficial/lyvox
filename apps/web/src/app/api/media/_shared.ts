import type { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";
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

// Single per-request auth context: memoizes ONE supabaseServer() client + ONE
// getUser() call per incoming Request, shared between rate-limit keying
// (resolveUserId) and the handler's auth check (requireAuthenticatedUser).
// Mirrors the pattern in app/api/likes/route.ts. Prevents a double getUser()
// round-trip and the narrow refresh-token-rotation race that comes from two
// independent supabaseServer() clients reading the same request cookies.
type RequestAuthContext = {
  supabase: ServerClient;
  user: User | null;
  error: { name?: string; message: string } | null;
};

const contextCache = new WeakMap<Request, Promise<RequestAuthContext>>();

function getRequestContext(request: Request): Promise<RequestAuthContext> {
  let cached = contextCache.get(request);
  if (!cached) {
    cached = (async () => {
      const supabase = (await supabaseServer()) as ServerClient;
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      return { supabase, user: user ?? null, error: error ?? null };
    })();
    contextCache.set(request, cached);
  }
  return cached;
}

// For withRateLimit's getUserId — resolves from the shared context so it
// doesn't trigger a second getUser() call. Errored auth keys by IP, same as
// before (an error means user stays null).
export async function resolveUserId(request: Request): Promise<string | null> {
  const { user } = await getRequestContext(request);
  return user?.id ?? null;
}

export async function requireAuthenticatedUser(
  request: Request,
): Promise<{ user: User; supabase: ServerClient } | ResponseResult> {
  const { supabase, user, error } = await getRequestContext(request);

  if (error) {
    // supabase-js reports an anonymous request as AuthSessionMissingError —
    // that is an auth failure (401), not a server fault. Other errors
    // (transport, config) stay 500 so they surface in monitoring.
    if (error.name === "AuthSessionMissingError") {
      return { response: unauthenticated() };
    }
    return { response: handleSupabaseError(error, ApiErrorCode.INTERNAL_ERROR) };
  }

  if (!user) {
    return { response: unauthenticated() };
  }

  return { user, supabase };
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
