import { supabaseServer } from "@/lib/supabaseServer";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { getIntegrationStatus } from "@/lib/integrations/registry";

export const runtime = "nodejs";

export async function GET() {
  const capability = await getIntegrationStatus("paid_boosts");
  if (!capability.effective) {
    return createErrorResponse(ApiErrorCode.FEATURE_DISABLED, { status: 404 });
  }

  const supabase = await supabaseServer();

  const { data: products, error } = await supabase
    .from("products")
    .select(
      "id, code, name, price_cents, currency, active, capability, benefit_type, duration_days, requires_advert, offer_version, tax_behavior",
    )
    .eq("capability", "paid_boosts")
    .eq("active", true)
    .order("price_cents", { ascending: true });

  if (error) {
    return handleSupabaseError(error, ApiErrorCode.FETCH_FAILED);
  }

  return createSuccessResponse({
    products: products || [],
  });
}
