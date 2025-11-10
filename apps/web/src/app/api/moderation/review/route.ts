import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import { hasAdminRole } from "@/lib/adminRole";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/**
 * POST /api/moderation/review
 * Allows moderator to approve or reject an advert
 * Requires: Admin role
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    // Check if user is admin
    const isAdmin = hasAdminRole(user);
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const body = await request.json();
    const { advert_id, action, reason } = body;

    if (!advert_id || !action) {
      return NextResponse.json(
        { ok: false, error: "MISSING_REQUIRED_FIELDS" },
        { status: 400 },
      );
    }

    if (!["approve", "reject", "flag"].includes(action)) {
      return NextResponse.json({ ok: false, error: "INVALID_ACTION" }, { status: 400 });
    }

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

