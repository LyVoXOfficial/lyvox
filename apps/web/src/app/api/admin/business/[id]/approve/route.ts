import { supabaseService } from "@/lib/supabaseService";
import { getAdminAccess } from "@/lib/auth/requireAdmin";
import {
  createErrorResponse,
  createSuccessResponse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { assertSameOrigin } from "@/lib/security/csrf";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const csrfError = assertSameOrigin(_req);
  if (csrfError) return csrfError;

  const { id } = await context.params;

  // ── Auth: require admin ────────────────────────────────────────────────────
  const access = await getAdminAccess();
  if (!access.ok) {
    return createErrorResponse(
      access.reason === "unauthenticated" ? ApiErrorCode.UNAUTH : ApiErrorCode.FORBIDDEN,
      { status: access.reason === "unauthenticated" ? 401 : access.reason === "mfa_required" ? 428 : 403 },
    );
  }
  const user = access.user;

  // ── Service-role client for all writes ─────────────────────────────────────
  const service = await supabaseService();

  // ── Verify business exists ─────────────────────────────────────────────────
  const { data: biz, error: fetchError } = await service
    .from("businesses")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !biz) {
    return createErrorResponse(ApiErrorCode.BUSINESS_NOT_FOUND, { status: 404 });
  }

  // ── D5: upsert kbo:verified row (safe select-then-update/insert) ──────────
  // Use select-then-update/insert to avoid the partial unique index upsert issue:
  // uq_ver_active is a partial index (WHERE status IN ('pending','verified')),
  // and supabase-js upsert can't express the partial predicate.
  const now = new Date().toISOString();
  const evidence = {
    source: "admin_override",
    approved_by: user.id,
    approved_at: now,
  };

  // Check for an existing pending or verified kbo row
  const { data: existingRow } = await service
    .from("verifications")
    .select("id")
    .eq("subject_type", "business")
    .eq("subject_id", id)
    .eq("method", "kbo")
    .in("status", ["pending", "verified"])
    .maybeSingle();

  if (existingRow) {
    // Update the existing row to verified
    const { error: updateVerError } = await service
      .from("verifications")
      .update({
        status: "verified",
        verified_at: now,
        evidence,
      })
      .eq("id", (existingRow as { id: string }).id);

    if (updateVerError) {
      return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, { status: 500 });
    }
  } else {
    // Insert a new kbo:verified row (D5 — NOT 'manual')
    const { error: insertError } = await service.from("verifications").insert({
      subject_type: "business",
      subject_id: id,
      method: "kbo",
      status: "verified",
      verified_at: now,
      evidence,
    });

    if (insertError) {
      return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, { status: 500 });
    }
  }

  // ── Activate the business ──────────────────────────────────────────────────
  const { error: activateError } = await service
    .from("businesses")
    .update({ status: "active" })
    .eq("id", id);

  if (activateError) {
    return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, { status: 500 });
  }

  // ── Re-read actual DB values (trigger fires synchronously) ─────────────────
  const { data: updated, error: reReadError } = await service
    .from("businesses")
    .select("entity_verified, status")
    .eq("id", id)
    .single();

  if (reReadError || !updated) {
    return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, { status: 500 });
  }

  return createSuccessResponse({
    entity_verified: (updated as { entity_verified: boolean; status: string }).entity_verified,
    business_status: (updated as { entity_verified: boolean; status: string }).status,
    method: "kbo",
  });
}
