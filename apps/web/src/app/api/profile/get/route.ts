import { supabaseServer } from "@/lib/supabaseServer";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  ApiErrorCode,
} from "@/lib/apiErrors";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createSuccessResponse({});
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, phone, verified_email, verified_phone, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return handleSupabaseError(error, ApiErrorCode.FETCH_FAILED);
  }

  return createSuccessResponse(data ?? {});
}
