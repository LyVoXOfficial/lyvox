import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";

export const runtime = "nodejs";

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: advertId } = await context.params;

  if (!advertId) {
    return NextResponse.json(
      { ok: false, error: "MISSING_ID" },
      { status: 400 },
    );
  }

  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  const { data: advert, error: fetchError } = await supabase
    .from("adverts")
    .select("id")
    .eq("id", advertId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      { ok: false, error: fetchError.message },
      { status: 400 },
    );
  }

  if (!advert) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const { data: mediaRows } = await supabase
    .from("media")
    .select("url")
    .eq("advert_id", advertId);

  const deleteSpecifics = await supabase
    .from("ad_item_specifics")
    .delete()
    .eq("advert_id", advertId);

  if (deleteSpecifics.error) {
    return NextResponse.json(
      { ok: false, error: deleteSpecifics.error.message },
      { status: 400 },
    );
  }

  const deleteMedia = await supabase
    .from("media")
    .delete()
    .eq("advert_id", advertId);

  if (deleteMedia.error) {
    return NextResponse.json(
      { ok: false, error: deleteMedia.error.message },
      { status: 400 },
    );
  }

  if (mediaRows?.length) {
    const storagePaths = mediaRows
      .map((row) => row.url)
      .filter((path) => path && !path.startsWith("http"));
    if (storagePaths.length) {
      await supabaseService().storage.from("ad-media").remove(storagePaths);
    }
  }

  const { error: deleteAdvertError } = await supabase
    .from("adverts")
    .delete()
    .eq("id", advertId);

  if (deleteAdvertError) {
    return NextResponse.json(
      { ok: false, error: deleteAdvertError.message },
      { status: 400 },
    );
  }

  await supabaseService()
    .from("logs")
    .insert({
      user_id: user.id,
      action: "advert_delete",
      details: { advertId },
    });

  return NextResponse.json({ ok: true });
}
