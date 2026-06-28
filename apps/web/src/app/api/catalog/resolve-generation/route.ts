import { supabaseServer } from "@/lib/supabaseServer";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/lib/apiErrors";
import { resolveGeneration } from "@/lib/catalog/resolveGeneration";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get("modelId");
  const yearStr = searchParams.get("year");

  if (!modelId) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "modelId is required",
    });
  }

  let year: number | null = null;
  if (yearStr) {
    const parsed = parseInt(yearStr, 10);
    if (Number.isNaN(parsed) || parsed < 1886 || parsed > 2100) {
      return createErrorResponse(ApiErrorCode.BAD_INPUT, {
        status: 400,
        detail: "year must be a number between 1886 and 2100",
      });
    }
    year = parsed;
  }

  const supabase = await supabaseServer();
  const result = await resolveGeneration(modelId, year, supabase);

  return createSuccessResponse(result);
}
