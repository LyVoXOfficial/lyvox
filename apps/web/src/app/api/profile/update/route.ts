import { supabaseServer } from "@/lib/supabaseServer";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { validateRequest } from "@/lib/validations";
import { updateProfileSchema } from "@/lib/validations/profile";

export const runtime = "nodejs";

export async function POST(req: Request) {
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

  const payload: Record<string, unknown> = { id: user.id };
  if (display_name !== undefined) payload.display_name = display_name;
  if (discover_prefs !== undefined) payload.discover_prefs = discover_prefs;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from("profiles").upsert(payload as any, {
    onConflict: "id",
  });

  if (error) {
    return handleSupabaseError(error, ApiErrorCode.UPDATE_FAILED);
  }

  return createSuccessResponse({});
}
