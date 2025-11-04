import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import { coerceConsentSnapshot, composeMarketingSnapshot } from "@/lib/consents";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { validateRequest } from "@/lib/validations";
import { updateConsentsSchema } from "@/lib/validations/profile";
import type { TablesInsert, TablesUpdate } from "@/lib/supabaseTypes";

export const runtime = "nodejs";

type ConsentLog = {
  id: number;
  action: string;
  details: unknown;
  created_at: string | null;
};

export async function POST(request: Request) {
  const parseResult = await safeJsonParse<{ marketingOptIn?: unknown }>(request);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const validationResult = validateRequest(updateConsentsSchema, parseResult.data);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const { marketingOptIn } = validationResult.data;

  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  const profileResult = await supabase
    .from("profiles")
    .select("consents")
    .eq("id", user.id)
    .maybeSingle();

  if (profileResult.error) {
    return handleSupabaseError(profileResult.error, ApiErrorCode.FETCH_FAILED);
  }

  const currentSnapshot = coerceConsentSnapshot(profileResult.data?.consents ?? null);
  const timestamp = new Date().toISOString();
  const nextSnapshot = composeMarketingSnapshot(currentSnapshot, marketingOptIn, timestamp);

  const updatePayload: TablesUpdate<"profiles"> = {
    consents: JSON.parse(JSON.stringify(nextSnapshot)),
  };

  const updateResult = await supabase.from("profiles").update(updatePayload).eq("id", user.id);

  if (updateResult.error) {
    return handleSupabaseError(updateResult.error, ApiErrorCode.UPDATE_FAILED);
  }

  let service;
  try {
    service = supabaseService();
  } catch {
    return createErrorResponse(ApiErrorCode.SERVICE_ROLE_MISSING, { status: 500 });
  }

  const auditDetails = {
    source: "profile",
    marketing_opt_in: marketingOptIn,
    previous: currentSnapshot?.marketing ?? null,
    next: nextSnapshot.marketing,
  };

  const logEntry: TablesInsert<"logs"> = {
    user_id: user.id,
    action: "consent_update",
    details: JSON.parse(JSON.stringify(auditDetails)) as TablesInsert<"logs">["details"],
  };

  const auditLog = await service.from("logs").insert(logEntry);

  if (auditLog.error) {
    return handleSupabaseError(auditLog.error, ApiErrorCode.INTERNAL_ERROR);
  }

  return createSuccessResponse({ consents: nextSnapshot });
}

export async function GET(request: Request) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  const profile = await supabase
    .from("profiles")
    .select("consents")
    .eq("id", user.id)
    .maybeSingle();

  if (profile.error) {
    return handleSupabaseError(profile.error, ApiErrorCode.FETCH_FAILED);
  }

  const snapshot = coerceConsentSnapshot(profile.data?.consents ?? null);

  let service;
  try {
    service = supabaseService();
  } catch {
    return createErrorResponse(ApiErrorCode.SERVICE_ROLE_MISSING, { status: 500 });
  }

  const logs = await service
    .from("logs")
    .select("id, action, details, created_at")
    .eq("user_id", user.id)
    .in("action", ["consent_accept", "consent_update"])
    .order("created_at", { ascending: true });

  if (logs.error) {
    return handleSupabaseError(logs.error, ApiErrorCode.FETCH_FAILED);
  }

  const history = (logs.data ?? []).map((entry) => ({
    id: entry.id,
    action: entry.action,
    details: entry.details,
    created_at: entry.created_at,
  })) as ConsentLog[];

  const payload = {
    generatedAt: new Date().toISOString(),
    consents: snapshot,
    history,
  };

  const url = new URL(request.url);
  const format = url.searchParams.get("format");

  const response = createSuccessResponse(payload);

  if (format === "download") {
    const filename = `lyvox-consent-history-${new Date().toISOString()}.json`;
    response.headers.set(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
  }

  return response;
}
