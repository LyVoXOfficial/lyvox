import { supabaseServer } from "@/lib/supabaseServer";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = supabaseServer();
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

  const { display_name } = parseResult.data;

  const payload = {
    id: user.id,
    display_name: display_name?.toString().slice(0, 80) ?? null,
  };

  const { error } = await supabase.from("profiles").upsert(payload, {
    onConflict: "id",
  });

  if (error) {
    return handleSupabaseError(error, ApiErrorCode.UPDATE_FAILED);
  }

  return createSuccessResponse({});
}
