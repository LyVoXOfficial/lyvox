import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import {
  ensureAdvertOwnership,
  requireAuthenticatedUser,
  MEDIA_LIMIT_PER_ADVERT,
} from "../_shared";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const SIGNED_UPLOAD_TTL_SECONDS = 5 * 60;

const sanitizeFileName = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "upload";

const buildPath = (userId: string, advertId: string, originalName: string) => {
  const safe = sanitizeFileName(originalName);
  const ext = safe.includes(".") ? safe.substring(safe.lastIndexOf(".") + 1) : "bin";
  const base = safe.replace(/\.[^.]+$/, "");
  const slug = `${base}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.slice(0, 80);
  return `${userId}/${advertId}/${slug}.${ext}`;
};

export async function POST(request: Request) {
  const { advertId, fileName, contentType, fileSize } = (await request.json().catch(() => ({}))) as {
    advertId?: string;
    fileName?: string;
    contentType?: string;
    fileSize?: number;
  };

  if (!advertId || typeof advertId !== "string") {
    return NextResponse.json({ ok: false, error: "MISSING_ADVERT_ID" }, { status: 400 });
  }

  if (!fileName || typeof fileName !== "string") {
    return NextResponse.json({ ok: false, error: "MISSING_FILE_NAME" }, { status: 400 });
  }

  if (!contentType || typeof contentType !== "string" || !contentType.startsWith("image/")) {
    return NextResponse.json({ ok: false, error: "UNSUPPORTED_CONTENT_TYPE" }, { status: 400 });
  }

  if (!Number.isFinite(fileSize) || fileSize! <= 0) {
    return NextResponse.json({ ok: false, error: "MISSING_FILE_SIZE" }, { status: 400 });
  }

  if (fileSize! > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { ok: false, error: "FILE_TOO_LARGE", limitBytes: MAX_FILE_SIZE_BYTES },
      { status: 413 },
    );
  }

  const supabase = supabaseServer();
  const authResult = await requireAuthenticatedUser(supabase);
  if ("response" in authResult) {
    return authResult.response;
  }
  const { user } = authResult;

  const ownership = await ensureAdvertOwnership({
    supabase,
    advertId,
    userId: user.id,
    denyLogAction: "media_sign_denied",
    denyLogDetails: { advertId, fileName },
  });
  if ("response" in ownership) {
    return ownership.response;
  }

  const { count: mediaCount, error: countError } = await supabase
    .from("media")
    .select("id", { count: "exact", head: true })
    .eq("advert_id", advertId);

  if (countError) {
    return NextResponse.json({ ok: false, error: countError.message }, { status: 400 });
  }

  if ((mediaCount ?? 0) >= MEDIA_LIMIT_PER_ADVERT) {
    return NextResponse.json(
      { ok: false, error: "LIMIT_REACHED", limit: MEDIA_LIMIT_PER_ADVERT },
      { status: 409 },
    );
  }

  const { data: lastSort } = await supabase
    .from("media")
    .select("sort")
    .eq("advert_id", advertId)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSort = Number.isFinite(lastSort?.sort) ? (lastSort!.sort ?? 0) + 1 : (mediaCount ?? 0);

  const storagePath = buildPath(user.id, advertId, fileName);

  const storage = supabaseService().storage.from("ad-media");
  const { data: signedUpload, error: signedError } = await storage.createSignedUploadUrl(
    storagePath,
    { upsert: false },
  );

  if (signedError || !signedUpload) {
    return NextResponse.json(
      { ok: false, error: signedError?.message ?? "SIGNED_URL_FAILED" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    path: storagePath,
    token: signedUpload.token,
    expiresIn: SIGNED_UPLOAD_TTL_SECONDS,
    orderIndex: nextSort,
    max: MEDIA_LIMIT_PER_ADVERT,
  });
}
