import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import type { TablesInsert } from "@/lib/supabaseTypes";

export const runtime = "nodejs";

export async function POST() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { data: defaultCategory, error: categoryError } = await supabase
    .from("categories")
    .select("id")
    .eq("level", 1)
    .eq("is_active", true)
    .order("sort", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (categoryError) {
    return NextResponse.json(
      { ok: false, error: "CATEGORY_LOOKUP_FAILED", message: categoryError.message },
      { status: 500 },
    );
  }

  const categoryId = defaultCategory?.id;
  if (!categoryId) {
    return NextResponse.json(
      { ok: false, error: "NO_DEFAULT_CATEGORY", message: "Active default category is not configured" },
      { status: 500 },
    );
  }

  const draft: TablesInsert<"adverts"> = {
    user_id: user.id,
    category_id: categoryId,
    title: "Черновик объявления",
    status: "draft",
    currency: "EUR",
  };

  const { data, error } = await supabase
    .from("adverts")
    .insert(draft)
    .select("id, status, category_id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: "CREATE_FAILED", message: error?.message ?? "Failed to create advert draft" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    advert: {
      id: data.id,
      status: data.status,
      category_id: data.category_id,
    },
  });
}
