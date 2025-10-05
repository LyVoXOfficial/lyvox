import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import { hasAdminRole } from "@/lib/adminRole";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";

export const runtime = "nodejs";

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const ADMIN_ATTEMPTS = parsePositiveInt(process.env.RATE_LIMIT_ADMIN_PER_MIN, 60);
const ADMIN_WINDOW_SEC = 60;

const reportAdminLimiter = createRateLimiter({
  limit: ADMIN_ATTEMPTS,
  windowSec: ADMIN_WINDOW_SEC,
  prefix: "report:admin",
});

type SupabaseClient = ReturnType<typeof supabaseServer>;
type SupabaseUser = Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>["data"]["user"];
type RequestContext = { supabase: SupabaseClient; user: SupabaseUser };

const contextCache = new WeakMap<Request, Promise<RequestContext>>();

const getRequestContext = (req: Request): Promise<RequestContext> => {
  let cached = contextCache.get(req);
  if (!cached) {
    const supabase = supabaseServer();
    cached = supabase.auth.getUser().then(({ data }) => ({ supabase, user: data.user ?? null }));
    contextCache.set(req, cached);
  }
  return cached;
};

const resolveUserId = (req: Request) => getRequestContext(req).then(({ user }) => user?.id ?? null);

const baseHandler = async (req: Request) => {
  const { supabase, user } = await getRequestContext(req);

  if (!hasAdminRole(user)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const { id, new_status, unpublish } = await req.json();

  if (!id || !["accepted", "rejected"].includes(new_status)) {
    return NextResponse.json({ ok: false, error: "BAD_INPUT" }, { status: 400 });
  }

  let adminClient;
  try {
    adminClient = supabaseService();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error:
          "SUPABASE_SERVICE_ROLE_KEY is not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server to enable moderation actions.",
      },
      { status: 500 },
    );
  }

  const { data: report, error: fetchError } = await adminClient
    .from("reports")
    .select("id, advert_id, status, reporter, adverts:advert_id ( id, user_id )")
    .eq("id", id)
    .single();

  if (fetchError || !report) {
    return NextResponse.json({ ok: false, error: fetchError?.message ?? "NOT_FOUND" }, { status: 404 });
  }

  const { error: updateError } = await adminClient
    .from("reports")
    .update({
      status: new_status,
      reviewed_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 });
  }

  if (new_status === "accepted" && report.adverts?.user_id) {
    await adminClient.rpc("trust_inc", { uid: report.adverts.user_id, pts: -15 }).catch(() => {});

    if (unpublish) {
      await adminClient
        .from("adverts")
        .update({ status: "inactive" })
        .eq("id", report.adverts.id)
        .catch(() => {});
    }
  }

  await supabase.from("logs").insert({
    user_id: user.id,
    action: "report_update",
    details: { id, new_status, unpublish: !!unpublish },
  });

  return NextResponse.json({ ok: true });
};

export const POST = withRateLimit(baseHandler, {
  limiter: reportAdminLimiter,
  getUserId: resolveUserId,
  makeKey: (_req, userId) => (userId ? userId : null),
});
