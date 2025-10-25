import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";

export const runtime = "nodejs";

const SIGNED_DOWNLOAD_TTL_SECONDS = 10 * 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const advertId = url.searchParams.get("advertId");

  if (!advertId) {
    return NextResponse.json({ ok: false, error: "MISSING_ADVERT_ID" }, { status: 400 });
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
    .select("id,user_id,status")
    .eq("id", advertId)
    .maybeSingle();

  if (advertError) {
    return NextResponse.json({ ok: false, error: advertError.message }, { status: 400 });
  }

  if (!advert) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  if (advert.user_id !== user.id) {
    await supabaseService()
      .from("logs")
      .insert({
        user_id: user.id,
        action: "media_list_denied",
        details: { advertId },
      });
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const { data: records, error: mediaError } = await supabase
    .from("media")
    .select("id,url,sort,w,h,created_at")
    .eq("advert_id", advertId)
    .order("sort", { ascending: true });

  if (mediaError) {
    return NextResponse.json({ ok: false, error: mediaError.message }, { status: 400 });
  }

  const storage = supabaseService().storage.from("ad-media");
  const items =
    records?.map(async (record) => {
      const path = record.url;

      if (path.startsWith("http://") || path.startsWith("https://")) {
        // Legacy public URLs – return as-is but note missing storage path.
        return {
          id: record.id,
          url: path,
          storagePath: null,
          sort: record.sort,
          w: record.w,
          h: record.h,
          created_at: record.created_at,
        };
      }

      const { data, error } = await storage.createSignedUrl(
        path,
        SIGNED_DOWNLOAD_TTL_SECONDS,
      );
      return {
        id: record.id,
        url: error ? null : data?.signedUrl ?? null,
        storagePath: path,
        sort: record.sort,
        w: record.w,
        h: record.h,
        created_at: record.created_at,
      };
    }) ?? [];

  const resolved = await Promise.all(items);

  return NextResponse.json({
    ok: true,
    items: resolved.filter((item) => item.url !== null),
    expiresIn: SIGNED_DOWNLOAD_TTL_SECONDS,
  });
}
