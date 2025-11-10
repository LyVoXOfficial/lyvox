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

  const { data: products, error } = await supabase
    .from("products")
    .select("id, code, name, price_cents, currency, active")
    .eq("active", true)
    .order("price_cents", { ascending: true });

  if (error) {
    return handleSupabaseError(error, ApiErrorCode.FETCH_FAILED);
  }

  return createSuccessResponse({
    products: products || [],
  });
}

