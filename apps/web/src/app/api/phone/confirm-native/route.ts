import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  ApiErrorCode,
} from "@/lib/apiErrors";

export const runtime = "nodejs";

export async function POST(_req: Request): Promise<Response> {
  // Step 1: authenticate via cookie client
  const cookie = await supabaseServer();
  const {
    data: { user },
  } = await cookie.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  // Step 2: prove Supabase actually verified the phone
  // We use the service-role admin API to read the authoritative auth record.
  // If phone_confirmed_at is absent/null (or the call errors), we write nothing.
  const service = await supabaseService();
  const { data, error } = await service.auth.admin.getUserById(user.id);

  if (error || !data?.user?.phone_confirmed_at) {
    return createErrorResponse(ApiErrorCode.VERIFICATION_REQUIRED, { status: 403 });
  }

  // Step 3: phone confirmed — write verified_phone via service-role only
  const { error: updateError } = await service
    .from("profiles")
    .update({ verified_phone: true })
    .eq("id", user.id);

  if (updateError) {
    return handleSupabaseError(updateError, ApiErrorCode.PHONE_UPDATE_FAILED);
  }

  return createSuccessResponse({});
}
