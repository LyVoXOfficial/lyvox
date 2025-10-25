import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";

export const runtime = "nodejs";

type Payload = {
  advertId?: string;
  orderedIds?: string[];
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Payload;
  const advertId = body.advertId;
  const orderedIds = body.orderedIds;

  if (!advertId || typeof advertId !== "string") {
    return NextResponse.json({ ok: false, error: "MISSING_ADVERT_ID" }, { status: 400 });
  }

  if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== "string")) {
    return NextResponse.json({ ok: false, error: "INVALID_ORDER" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { data: advert, error: advertError } = await supabase
    .from("adverts")
    .select("id,user_id")
    .eq("id", advertId)
    .maybeSingle();

  if (advertError) {
    return NextResponse.json({ ok: false, error: advertError.message }, { status: 400 });
  }

  if (!advert || advert.user_id !== user.id) {
    await supabaseService()
      .from("logs")
      .insert({
        user_id: user.id,
        action: "media_reorder_denied",
        details: { advertId, orderedIds },
      });
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const { data: media, error: mediaError } = await supabase
    .from("media")
    .select("id")
    .eq("advert_id", advertId);

  if (mediaError) {
    return NextResponse.json({ ok: false, error: mediaError.message }, { status: 400 });
  }

  const mediaIds = new Set(media?.map((item) => item.id) ?? []);
  if (!orderedIds.every((id) => mediaIds.has(id))) {
    return NextResponse.json({ ok: false, error: "UNKNOWN_MEDIA_ID" }, { status: 400 });
  }

  const updates = orderedIds.map((id, index) =>
    supabase.from("media").update({ sort: index }).eq("id", id),
  );
  await Promise.all(updates);

  return NextResponse.json({ ok: true });
}
