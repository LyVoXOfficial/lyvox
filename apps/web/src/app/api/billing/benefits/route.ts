import { supabaseServer } from "@/lib/supabaseServer";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const advertId = searchParams.get("advert_id");

  let query = supabase
    .from("benefits")
    .select("id, purchase_id, user_id, advert_id, benefit_type, valid_from, valid_until, created_at")
    .eq("user_id", user.id)
    .gt("valid_until", new Date().toISOString())
    .order("valid_until", { ascending: false });

  if (advertId) {
    query = query.eq("advert_id", advertId);
  }

  const { data: benefits, error } = await query;

  if (error) {
    return handleSupabaseError(error, ApiErrorCode.FETCH_FAILED);
  }

  return createSuccessResponse({
    benefits: benefits || [],
  });
}

