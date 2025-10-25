import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function POST() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { data: defaultCategory } = await supabase
    .from("categories")
    .select("id")
    .eq("level", 1)
    .order("sort", { ascending: true })
    .limit(1)
    .maybeSingle();

  const categoryId = defaultCategory?.id;

  const { data, error } = await supabase
    .from("adverts")
    .insert({
      user_id: user.id,
      category_id: categoryId,
      title: "Черновик объявления",
      status: "draft",
    })
    .select("id, status, category_id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "CREATE_FAILED" },
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
