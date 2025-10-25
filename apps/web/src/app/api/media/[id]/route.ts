import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { data: media, error: mediaError } = await supabase
    .from("media")
    .select("id,advert_id,url,sort")
    .eq("id", id)
    .maybeSingle();

  if (mediaError) {
    return NextResponse.json({ ok: false, error: mediaError.message }, { status: 400 });
  }

  if (!media) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const { data: advert, error: advertError } = await supabase
    .from("adverts")
    .select("id,user_id")
    .eq("id", media.advert_id)
    .maybeSingle();

  if (advertError) {
    return NextResponse.json({ ok: false, error: advertError.message }, { status: 400 });
  }

  if (!advert || advert.user_id !== user.id) {
    await supabaseService()
      .from("logs")
      .insert({
        user_id: user.id,
        action: "media_delete_denied",
        details: { mediaId: id, advertId: media.advert_id },
      });
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const service = supabaseService();
  await service.storage.from("ad-media").remove([media.url]);

  const { error: deleteError } = await supabase.from("media").delete().eq("id", id);

  if (deleteError) {
    return NextResponse.json({ ok: false, error: deleteError.message }, { status: 400 });
  }

  const { data: remaining } = await supabase
    .from("media")
    .select("id,sort")
    .eq("advert_id", media.advert_id)
    .order("sort", { ascending: true });

  if (remaining && remaining.length) {
    const updates = remaining.map((item, index) =>
      supabase.from("media").update({ sort: index }).eq("id", item.id),
    );
    await Promise.all(updates);
  }

  return NextResponse.json({ ok: true });
}
