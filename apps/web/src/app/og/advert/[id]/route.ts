import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabaseService";
import { signMediaUrls } from "@/lib/media/signMediaUrls";
import { absoluteUrl } from "@/lib/seo/baseUrl";

export const runtime = "nodejs";

const SIGNED_TTL_SECONDS = 60 * 60; // 1 hour — route itself is re-hit on each crawl, so short-lived is fine
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fallbackRedirect(): NextResponse {
  const response = NextResponse.redirect(absoluteUrl("/opengraph-image"), 302);
  response.headers.set("Cache-Control", "public, max-age=300");
  return response;
}

/**
 * Stable, non-expiring og:image URL for /ad/:id pages. Crawlers and social
 * scrapers hit this route (not a raw signed Supabase URL), so the freshly
 * signed URL it redirects to never appears in cached OG metadata — only this
 * route's own URL does, and that always resolves to a live signed URL.
 */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (!id || !UUID_REGEX.test(id)) {
    return fallbackRedirect();
  }

  try {
    const service = await supabaseService();

    const { data: advert, error: advertError } = await service
      .from("adverts")
      .select("id,status")
      .eq("id", id)
      .maybeSingle();

    if (advertError || !advert || advert.status !== "active") {
      return fallbackRedirect();
    }

    const { data: media, error: mediaError } = await service
      .from("media")
      .select("url,preview_url,sort")
      .eq("advert_id", id)
      .order("sort", { ascending: true })
      .limit(1);

    if (mediaError || !media?.length) {
      return fallbackRedirect();
    }

    const [signed] = await signMediaUrls(media, SIGNED_TTL_SECONDS);

    const redirectUrl = signed.previewUrl ?? signed.signedUrl;
    if (!redirectUrl) {
      return fallbackRedirect();
    }

    const response = NextResponse.redirect(redirectUrl, 302);
    response.headers.set("Cache-Control", "public, max-age=300");
    return response;
  } catch {
    return fallbackRedirect();
  }
}
