import { supabaseServer } from "@/lib/supabaseServer";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { validateRequest } from "@/lib/validations";
import { updateNotificationPreferencesSchema } from "@/lib/validations/notifications";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("notification_preferences")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return handleSupabaseError(error, ApiErrorCode.FETCH_FAILED);
  }

  const preferences = profile?.notification_preferences || {
    email: {},
    push: {},
    sms: {},
  };

  return createSuccessResponse({ preferences });
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  const parseResult = await safeJsonParse<{
    email?: Record<string, boolean>;
    push?: Record<string, boolean>;
    sms?: Record<string, boolean>;
  }>(req);

  if (!parseResult.success) {
    return parseResult.response;
  }

  const validationResult = validateRequest(
    updateNotificationPreferencesSchema,
    parseResult.data,
  );

  if (!validationResult.success) {
    return validationResult.response;
  }

  // Get current preferences
  const { data: profile } = await supabase
    .from("profiles")
    .select("notification_preferences")
    .eq("id", user.id)
    .maybeSingle();

  const currentPreferences = profile?.notification_preferences || {
    email: {},
    push: {},
    sms: {},
  };

  // Merge with new preferences
  const updatedPreferences = {
    email: { ...currentPreferences.email, ...validationResult.data.email },
    push: { ...currentPreferences.push, ...validationResult.data.push },
    sms: { ...currentPreferences.sms, ...validationResult.data.sms },
  };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ notification_preferences: updatedPreferences })
    .eq("id", user.id);

  if (updateError) {
    return handleSupabaseError(updateError, ApiErrorCode.UPDATE_FAILED);
  }

  return createSuccessResponse({ preferences: updatedPreferences });
}

