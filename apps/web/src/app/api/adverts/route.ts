import { supabaseServer } from "@/lib/supabaseServer";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  ApiErrorCode,
} from "@/lib/apiErrors";
import type { TablesInsert } from "@/lib/supabaseTypes";

export const runtime = "nodejs";

export async function POST() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTHENTICATED, { status: 401 });
  }

  const { data: defaultCategory, error: categoryError } = await supabase
    .from("categories")
    .select("id")
    .eq("level", 1)
    .eq("is_active", true)
    .order("sort", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (categoryError) {
    return handleSupabaseError(categoryError, ApiErrorCode.CATEGORY_LOOKUP_FAILED);
  }

  const categoryId = defaultCategory?.id;
  if (!categoryId) {
    return createErrorResponse(ApiErrorCode.CATEGORY_LOOKUP_FAILED, {
      status: 500,
      message: "Active default category is not configured",
    });
  }

  const draft: TablesInsert<"adverts"> = {
    user_id: user.id,
    category_id: categoryId,
    title: "Черновик объявления",
    status: "draft",
    currency: "EUR",
  };

  const { data, error } = await supabase
    .from("adverts")
    .insert(draft)
    .select("id, status, category_id")
    .single();

  if (error || !data) {
    return handleSupabaseError(error, ApiErrorCode.CREATE_FAILED);
  }

  return createSuccessResponse({
    advert: {
      id: data.id,
      status: data.status,
      category_id: data.category_id,
    },
  });
}
