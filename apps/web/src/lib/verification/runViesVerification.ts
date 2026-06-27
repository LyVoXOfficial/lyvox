import type { SupabaseClient } from "@supabase/supabase-js";
import { checkViesVat } from "@/lib/verification/vies";
import { legalNameMatches } from "@/lib/verification/nameMatch";

// Exponential backoff delays by attempt count (seconds, capped at 30).
// retry_count is the NEW count (prev+1).
function backoffSeconds(newCount: number): number {
  if (newCount === 1) return 2;
  if (newCount === 2) return 8;
  return 30; // 3 and above → cap
}

export type ViesVerificationResult = {
  method: "vies" | "kbo";
  status: "verified" | "failed" | "pending";
  entity_verified: boolean;
  business_status: string;
  evidence: Record<string, unknown>;
};

/**
 * Core VIES verification logic for T9+T11.
 *
 * Reads the business + its pending vies verification row, calls VIES (if vat_liable),
 * updates the row in-place (D7 — never inserts a second row), and updates
 * businesses.status if needed. Returns a result shape the route/cron can map to HTTP.
 *
 * "not found" is signalled via business_status:"not_found" — the caller maps this to 404.
 */
export async function runViesVerification(
  service: SupabaseClient,
  businessId: string,
): Promise<ViesVerificationResult> {
  // ── 1. Load business ──────────────────────────────────────────────────────
  const { data: biz, error: bizErr } = await service
    .from("businesses")
    .select("vat_number, vat_liable, legal_name, status")
    .eq("id", businessId)
    .maybeSingle();

  if (bizErr || !biz) {
    return {
      method: "vies",
      status: "failed",
      entity_verified: false,
      business_status: "not_found",
      evidence: { error: bizErr?.message ?? "not_found" },
    };
  }

  const { vat_number, vat_liable, legal_name, status: currentBizStatus } = biz as {
    vat_number: string | null;
    vat_liable: boolean;
    legal_name: string;
    status: string;
  };

  // ── 2. KBO-only path (D1/D2) ──────────────────────────────────────────────
  if (!vat_liable) {
    return {
      method: "kbo",
      status: "pending",
      entity_verified: false,
      business_status: currentBizStatus,
      evidence: { note: "awaiting_admin_no_vat" },
    };
  }

  // ── 3. Load the existing vies:pending row (for retry_count) ───────────────
  const { data: verRow } = await service
    .from("verifications")
    .select("id, evidence")
    .eq("subject_id", businessId)
    .eq("method", "vies")
    .eq("status", "pending")
    .maybeSingle();

  const prevEvidence = ((verRow as { evidence?: Record<string, unknown> } | null)?.evidence ?? {}) as Record<string, unknown>;
  const prevRetryCount = typeof prevEvidence.retry_count === "number" ? prevEvidence.retry_count : 0;

  // ── 4. VIES call ──────────────────────────────────────────────────────────
  const vies = await checkViesVat("BE", vat_number ?? "");

  // ── 5. Branch & UPDATE ────────────────────────────────────────────────────

  if (vies.outcome === "valid") {
    const nameMatch = legalNameMatches(vies.name, legal_name);

    if (nameMatch) {
      // Auto-verify path
      await service
        .from("verifications")
        .update({
          status: "verified",
          verified_at: new Date().toISOString(),
          evidence: {
            requestDate: vies.requestDate,
            requestIdentifier: vies.requestIdentifier,
            name_match: "auto",
          },
        })
        .eq("subject_id", businessId)
        .eq("method", "vies")
        .eq("status", "pending");

      // Ensure business stays active (B1)
      if (currentBizStatus !== "active") {
        await service
          .from("businesses")
          .update({ status: "active" })
          .eq("id", businessId);
      }

      // Read back entity_verified (trigger should have flipped it)
      const { data: bizAfter } = await service
        .from("businesses")
        .select("entity_verified")
        .eq("id", businessId)
        .maybeSingle();

      const entityVerified =
        (bizAfter as { entity_verified?: boolean } | null)?.entity_verified === true;

      return {
        method: "vies",
        status: "verified",
        entity_verified: entityVerified,
        business_status: currentBizStatus !== "active" ? "active" : currentBizStatus,
        evidence: {
          requestDate: vies.requestDate,
          requestIdentifier: vies.requestIdentifier,
          name_match: "auto",
        },
      };
    } else {
      // Name mismatch — stays pending for admin review
      const newEvidence = {
        ...prevEvidence,
        requestDate: vies.requestDate,
        requestIdentifier: vies.requestIdentifier,
        name_match: "mismatch",
      };

      await service
        .from("verifications")
        .update({ evidence: newEvidence })
        .eq("subject_id", businessId)
        .eq("method", "vies")
        .eq("status", "pending");

      const { data: bizAfter } = await service
        .from("businesses")
        .select("entity_verified")
        .eq("id", businessId)
        .maybeSingle();

      const entityVerified =
        (bizAfter as { entity_verified?: boolean } | null)?.entity_verified === true;

      return {
        method: "vies",
        status: "pending",
        entity_verified: entityVerified,
        business_status: currentBizStatus,
        evidence: newEvidence,
      };
    }
  }

  if (vies.outcome === "invalid") {
    await service
      .from("verifications")
      .update({
        status: "failed",
        evidence: { ...prevEvidence, userError: "INVALID" },
      })
      .eq("subject_id", businessId)
      .eq("method", "vies")
      .eq("status", "pending");

    // Demote provisional active business (B3)
    let finalBizStatus = currentBizStatus;
    if (currentBizStatus === "active") {
      await service
        .from("businesses")
        .update({ status: "suspended" })
        .eq("id", businessId);
      finalBizStatus = "suspended";
    }

    return {
      method: "vies",
      status: "failed",
      entity_verified: false,
      business_status: finalBizStatus,
      evidence: { userError: "INVALID" },
    };
  }

  if (vies.outcome === "bad_input") {
    await service
      .from("verifications")
      .update({
        status: "failed",
        evidence: { ...prevEvidence, error: vies.error },
      })
      .eq("subject_id", businessId)
      .eq("method", "vies")
      .eq("status", "pending");

    return {
      method: "vies",
      status: "failed",
      entity_verified: false,
      business_status: currentBizStatus,
      evidence: { error: vies.error },
    };
  }

  // outcome === "unavailable" — transient, bump retry meta, provisional stands
  const newCount = prevRetryCount + 1;
  const delaySec = backoffSeconds(newCount);
  // Add small jitter (0-1s) expressed as a fractional ISO — we use ms precision
  const jitterMs = Math.floor(Math.random() * 1000);
  const nextRetryAt = new Date(Date.now() + delaySec * 1000 + jitterMs).toISOString();

  const unavailableEvidence = {
    ...prevEvidence,
    retry_count: newCount,
    next_retry_at: nextRetryAt,
    last_error: vies.error,
  };

  await service
    .from("verifications")
    .update({ evidence: unavailableEvidence })
    .eq("subject_id", businessId)
    .eq("method", "vies")
    .eq("status", "pending");

  const { data: bizAfter } = await service
    .from("businesses")
    .select("entity_verified")
    .eq("id", businessId)
    .maybeSingle();

  const entityVerified =
    (bizAfter as { entity_verified?: boolean } | null)?.entity_verified === true;

  return {
    method: "vies",
    status: "pending",
    entity_verified: entityVerified,
    business_status: currentBizStatus,
    evidence: unavailableEvidence,
  };
}
