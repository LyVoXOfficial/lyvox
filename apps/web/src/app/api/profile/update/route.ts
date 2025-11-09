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

  const parseResult = await safeJsonParse<{ display_name?: unknown }>(req);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const validationResult = validateRequest(updateProfileSchema, parseResult.data);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const { display_name } = validationResult.data;

  const payload = {
    id: user.id,
    display_name: display_name ?? null,
  };

  const { error } = await supabase.from("profiles").upsert(payload, {
    onConflict: "id",
  });

  if (error) {
    return handleSupabaseError(error, ApiErrorCode.UPDATE_FAILED);
  }

  return createSuccessResponse({});
}
