import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import { hasAdminRole } from "@/lib/adminRole";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/**
 * POST /api/moderation/analyze
 * Triggers AI moderation analysis for an advert
 * Requires: Admin or service role
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
    const { advert_id } = body;

    if (!advert_id) {
      return NextResponse.json({ ok: false, error: "MISSING_ADVERT_ID" }, { status: 400 });
    }

    // Fetch advert data
    const { data: advert, error: advertError } = await supabase
      .from("adverts")
      .select("id, title, description, category_id, categories(name_en, name_nl, name_fr, name_de, name_ru)")
      .eq("id", advert_id)
      .single();

    if (advertError || !advert) {
      return NextResponse.json({ ok: false, error: "ADVERT_NOT_FOUND" }, { status: 404 });
    }

    // Get category name
    const categoryName = (advert.categories as any)?.name_en || "Unknown";

    // Call Edge Function for AI moderation
    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-moderation`;
    const response = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        advert_id: advert.id,
        title: advert.title,
        description: advert.description,
        category: categoryName,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Edge Function error:", errorData);
      return NextResponse.json(
        { ok: false, error: "AI_MODERATION_FAILED", detail: errorData },
        { status: 500 },
      );
    }

    const result = await response.json();

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    console.error("Moderation analyze error:", error);
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

