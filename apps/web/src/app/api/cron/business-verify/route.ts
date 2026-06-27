import { supabaseService } from "@/lib/supabaseService";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/lib/apiErrors";
import { runViesVerification } from "@/lib/verification/runViesVerification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sweep up to 50 vies:pending rows whose retry window has elapsed.
// Auth: `Authorization: Bearer ${CRON_SECRET}` — fail-closed (exact saved-search-alerts pattern).

const LIMIT = 50;

export async function GET(request: Request) {
  // Read CRON_SECRET inside the handler so the "unset → 401" test can manipulate it.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401, detail: "Cron auth required" });
  }

  const service = await supabaseService();

  // Select vies:pending rows where next_retry_at is NULL (first attempt) or has elapsed.
  // PostgREST jsonb path filter: evidence->>'next_retry_at'
  const now = new Date().toISOString();
  const { data: rows, error } = await service
    .from("verifications")
    .select("subject_id, evidence")
    .eq("method", "vies")
    .eq("status", "pending")
    .or(`evidence->>next_retry_at.is.null,evidence->>next_retry_at.lte.${now}`)
    .limit(LIMIT);

  if (error) {
    return createErrorResponse(ApiErrorCode.FETCH_FAILED, { status: 500, detail: error.message });
  }

  const pendingRows = (rows ?? []) as Array<{ subject_id: string; evidence: Record<string, unknown> }>;

  let verified = 0;
  let failed = 0;
  let pending = 0;

  for (const row of pendingRows) {
    try {
      const result = await runViesVerification(service, row.subject_id);
      if (result.status === "verified") verified++;
      else if (result.status === "failed") failed++;
      else pending++;
    } catch (err) {
      console.error("business-verify cron: error processing", { subject_id: row.subject_id, err });
      pending++;
    }
  }

  return createSuccessResponse({
    processed: pendingRows.length,
    verified,
    failed,
    pending,
  });
}
