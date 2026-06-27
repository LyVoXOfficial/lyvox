import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  ApiErrorCode,
} from "@/lib/apiErrors";
import type { TablesInsert } from "@/lib/supabaseTypes";
import { checkUserBlocked } from "@/lib/fraud/checkUserBlocked";
import { isViewerVerified } from "@/lib/auth/requireVerified";
import { canSellAsBusiness } from "@/lib/auth/canSellAsBusiness";

export const runtime = "nodejs";

export async function POST(req?: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTHENTICATED, { status: 401 });
  }

  if (!(await isViewerVerified(supabase, user.id))) {
    return createErrorResponse(ApiErrorCode.VERIFICATION_REQUIRED, { status: 403, detail: "Phone verification required to publish" });
  }

  // Check if user is blocked
  const blockCheck = await checkUserBlocked(user.id);
  if (blockCheck.isBlocked) {
    return createErrorResponse(ApiErrorCode.FORBIDDEN, {
      status: 403,
      detail: blockCheck.reason || "Account is temporarily blocked",
    });
  }

  // Parse optional business_id from request body
  let businessId: string | null = null;
  if (req) {
    try {
      const body = await req.json();
      if (body && typeof body.business_id === "string" && body.business_id.length > 0) {
        businessId = body.business_id;
      }
    } catch (err) {
      // body is optional — ignore parse errors
      if (process.env.NODE_ENV !== "production") console.warn("[POST /api/adverts] body parse failed", err);
    }
  }

  // If posting as a business, enforce canSellAsBusiness gate
  if (businessId) {
    const check = await canSellAsBusiness(supabase, user.id, businessId);
    if (!check.ok) {
      return createErrorResponse(ApiErrorCode.VERIFICATION_REQUIRED, {
        status: 403,
        detail: check.reason,
      });
    }
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
      detail: "Active default category is not configured",
    });
  }

  const draft: TablesInsert<"adverts"> = {
    user_id: user.id,
    category_id: categoryId,
    title: "Черновик объявления",
    status: "draft",
    currency: "EUR",
    ...(businessId ? { business_id: businessId } : {}),
  };

  const service = await supabaseService();
  const { data, error } = await service
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
