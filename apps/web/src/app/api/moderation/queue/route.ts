import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasAdminRole } from "@/lib/adminRole";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/**
 * GET /api/moderation/queue
 * Returns list of adverts pending moderation
 * Requires: Admin role
 * Query params: status, limit, offset
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Validate status
    const validStatuses = ["pending", "pending_review", "flagged", "all"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 400 });
    }

    // Build query
    let query = supabase
      .from("adverts")
      .select(
        `
        id,
        title,
        description,
        price,
        currency,
        status,
        moderation_status,
        ai_moderation_score,
        ai_moderation_reason,
        created_at,
        user_id,
        profiles!adverts_user_id_fkey (
          display_name,
          verified_email,
          verified_phone
        ),
        categories (
          name_en,
          name_nl,
          name_fr,
          name_de,
          name_ru
        )
      `,
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status
    if (status !== "all") {
      query = query.eq("moderation_status", status);
    } else {
      query = query.in("moderation_status", ["pending", "pending_review", "flagged"]);
    }

    const { data: adverts, error, count } = await query;

    if (error) {
      console.error("Failed to fetch moderation queue:", error);
      return NextResponse.json({ ok: false, error: "FETCH_FAILED" }, { status: 500 });
    }

    // Get total count for pagination
    let countQuery = supabase
      .from("adverts")
      .select("id", { head: true, count: "exact" });

    if (status !== "all") {
      countQuery = countQuery.eq("moderation_status", status);
    } else {
      countQuery = countQuery.in("moderation_status", ["pending", "pending_review", "flagged"]);
    }

    const { count: totalCount } = await countQuery;

    return NextResponse.json({
      ok: true,
      data: {
        adverts: adverts || [],
        pagination: {
          total: totalCount || 0,
          limit,
          offset,
          hasMore: (totalCount || 0) > offset + limit,
        },
      },
    });
  } catch (error) {
    console.error("Moderation queue error:", error);
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

