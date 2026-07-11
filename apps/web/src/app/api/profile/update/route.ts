import { supabaseServer } from "@/lib/supabaseServer";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { assertSameOrigin } from "@/lib/security/csrf";
import { validateRequest } from "@/lib/validations";
import { updateProfileSchema } from "@/lib/validations/profile";
import type { TablesUpdate } from "@/lib/supabaseTypes";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  const parseResult = await safeJsonParse<{ display_name?: unknown; discover_prefs?: unknown }>(req);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const validationResult = validateRequest(updateProfileSchema, parseResult.data);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const { display_name, discover_prefs } = validationResult.data;

  const payload: TablesUpdate<"profiles"> = {};
  if (display_name !== undefined) payload.display_name = display_name;
  if (discover_prefs !== undefined) payload.discover_prefs = discover_prefs;

  const { error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", user.id)
    .select("id")
    .single();

  if (error) {
    return handleSupabaseError(error, ApiErrorCode.UPDATE_FAILED);
  }

  return createSuccessResponse({});
}
