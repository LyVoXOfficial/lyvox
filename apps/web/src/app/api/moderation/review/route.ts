import { NextRequest, NextResponse } from "next/server";
import { revalidateAdvert } from "@/lib/advert/advertDetail";
import { supabaseService } from "@/lib/supabaseService";
import { getAdminAccess } from "@/lib/auth/requireAdmin";
import { assertSameOrigin } from "@/lib/security/csrf";
import { validateRequest, moderationReviewSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/**
 * POST /api/moderation/review
 * Allows moderator to approve or reject an advert
 * Requires: Admin role
 */
export async function POST(request: NextRequest) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  try {
    const access = await getAdminAccess();
    if (!access.ok) {
      const status = access.reason === "unauthenticated" ? 401 : access.reason === "mfa_required" ? 428 : 403;
      return NextResponse.json({ ok: false, error: access.reason.toUpperCase() }, { status });
    }
    const user = access.user;

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "MISSING_REQUIRED_FIELDS" },
        { status: 400 },
      );
    }

    const validation = validateRequest(moderationReviewSchema, rawBody);
    if (!validation.success) {
      return validation.response;
    }

    const { advert_id, action, reason } = validation.data;

    const service = await supabaseService();

    // Update advert status
    const newStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "flagged";
    const { error: updateError } = await service
      .from("adverts")
      .update({
        moderation_status: newStatus,
        status: action === "approve" ? "active" : action === "reject" ? "draft" : "draft",
      })
      .eq("id", advert_id);

    if (updateError) {
      console.error("Failed to update advert:", updateError);
      return NextResponse.json({ ok: false, error: "UPDATE_FAILED" }, { status: 500 });
    }

    // PERF-01: a moderation status change flips public visibility — bust the
    // cached /ad/[id] detail so it can't linger in the shared cache.
    revalidateAdvert(advert_id);

    // Log moderation action
    const { error: logError } = await service.from("moderation_logs").insert({
      advert_id,
      moderation_type: "manual",
      moderator_id: user.id,
      recommendation: action === "approve" ? "approve" : action === "reject" ? "reject" : "review",
      action_taken: newStatus,
      reason: reason || null,
      metadata: {
        reviewed_at: new Date().toISOString(),
      },
    });

    if (logError) {
      console.error("Failed to log moderation action:", logError);
      // Don't fail the request if logging fails
    }

    return NextResponse.json({
      ok: true,
      data: {
        advert_id,
        action,
        status: newStatus,
      },
    });
  } catch (error) {
    console.error("Moderation review error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
