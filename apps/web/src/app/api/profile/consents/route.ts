import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import { coerceConsentSnapshot, composeMarketingSnapshot } from "@/lib/consents";
import type { TablesInsert, TablesUpdate } from "@/lib/supabaseTypes";

export const runtime = "nodejs";

type PostBody = {
  marketingOptIn?: unknown;
};

type ConsentLog = {
  id: number;
  action: string;
  details: unknown;
  created_at: string | null;
};

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

export async function POST(request: Request) {
  let body: PostBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const marketingOptIn = parseBoolean(body.marketingOptIn);
  if (marketingOptIn === null) {
    return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTH" }, { status: 401 });
  }

  const profileResult = await supabase
    .from("profiles")
    .select("consents")
    .eq("id", user.id)
    .maybeSingle();

  if (profileResult.error) {
    return NextResponse.json(
      { ok: false, error: "PROFILE_LOOKUP_FAILED", detail: profileResult.error.message },
      { status: 500 },
    );
  }

  const currentSnapshot = coerceConsentSnapshot(profileResult.data?.consents ?? null);
  const timestamp = new Date().toISOString();
  const nextSnapshot = composeMarketingSnapshot(currentSnapshot, marketingOptIn, timestamp);

  const updatePayload: TablesUpdate<"profiles"> = {
    consents: JSON.parse(JSON.stringify(nextSnapshot)),
  };

  const updateResult = await supabase.from("profiles").update(updatePayload).eq("id", user.id);

  if (updateResult.error) {
    return NextResponse.json(
      { ok: false, error: "CONSENT_UPDATE_FAILED", detail: updateResult.error.message },
      { status: 500 },
    );
  }

  let service;
  try {
    service = supabaseService();
  } catch {
    return NextResponse.json(
      { ok: false, error: "SERVICE_ROLE_MISSING" },
      { status: 500 },
    );
  }

  const auditDetails = {
    source: "profile",
    marketing_opt_in: marketingOptIn,
    previous: currentSnapshot?.marketing ?? null,
    next: nextSnapshot.marketing,
  };

  const logEntry: TablesInsert<"logs"> = {
    user_id: user.id,
    action: "consent_update",
    details: JSON.parse(JSON.stringify(auditDetails)) as TablesInsert<"logs">["details"],
  };

  const auditLog = await service.from("logs").insert(logEntry);

  if (auditLog.error) {
    return NextResponse.json(
      { ok: false, error: "CONSENT_LOG_FAILED", detail: auditLog.error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, consents: nextSnapshot });
}

export async function GET(request: Request) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTH" }, { status: 401 });
  }

  const profile = await supabase
    .from("profiles")
    .select("consents")
    .eq("id", user.id)
    .maybeSingle();

  if (profile.error) {
    return NextResponse.json(
      { ok: false, error: "PROFILE_LOOKUP_FAILED", detail: profile.error.message },
      { status: 500 },
    );
  }

  const snapshot = coerceConsentSnapshot(profile.data?.consents ?? null);

  let service;
  try {
    service = supabaseService();
  } catch {
    return NextResponse.json(
      { ok: false, error: "SERVICE_ROLE_MISSING" },
      { status: 500 },
    );
  }

  const logs = await service
    .from("logs")
    .select("id, action, details, created_at")
    .eq("user_id", user.id)
    .in("action", ["consent_accept", "consent_update"])
    .order("created_at", { ascending: true });

  if (logs.error) {
    return NextResponse.json(
      { ok: false, error: "CONSENT_LOG_FETCH_FAILED", detail: logs.error.message },
      { status: 500 },
    );
  }

  const history = (logs.data ?? []).map((entry) => ({
    id: entry.id,
    action: entry.action,
    details: entry.details,
    created_at: entry.created_at,
  })) as ConsentLog[];

  const payload = {
    generatedAt: new Date().toISOString(),
    consents: snapshot,
    history,
  };

  const url = new URL(request.url);
  const format = url.searchParams.get("format");

  const response = NextResponse.json(payload);

  if (format === "download") {
    const filename = `lyvox-consent-history-${new Date().toISOString()}.json`;
    response.headers.set(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
  }

  return response;
}
