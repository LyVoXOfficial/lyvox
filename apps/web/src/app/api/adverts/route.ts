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
import { invokeFraudCheck } from "@/lib/fraud/invokeFraudCheck";
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

  // Verification is NOT required to create a draft (Zeigarnik effect: gate at publish, not at form start).
  // Fail-closed: a draft creation counts as a high-risk mutation — we must not
  // wave a possibly-blocked user through on a transient DB error.
  const blockCheck = await checkUserBlocked(user.id, { failClosed: true });
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

  // Velocity check: fire user fraud rules (advert_count, account_age_activity) so
  // bursty creation is caught in runtime and sets blocked_until for future requests.
  // Awaited with a 5-second cap inside invokeFraudCheck — does not fire-and-forget
  // because Vercel may kill the function after response if we void here.
  await invokeFraudCheck({ check_type: "user", user_id: user.id });

  return createSuccessResponse({
    advert: {
      id: data.id,
      status: data.status,
      category_id: data.category_id,
    },
  });
}
