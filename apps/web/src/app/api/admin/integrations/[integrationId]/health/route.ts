import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/requireAdmin";
import { INFRASTRUCTURE_REGISTRY } from "@/lib/integrations/registry";
import { getRedis } from "@/lib/redis";
import { assertSameOrigin } from "@/lib/security/csrf";
import { supabaseService } from "@/lib/supabaseService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProbeResult = {
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  safeErrorCode: string | null;
};

async function probe(integrationId: string): Promise<ProbeResult> {
  try {
    if (integrationId === "supabase_core") {
      const service = await supabaseService();
      const { error } = await service.from("platform_settings").select("key").limit(1);
      return error
        ? { status: "unhealthy", safeErrorCode: "SUPABASE_QUERY_FAILED" }
        : { status: "healthy", safeErrorCode: null };
    }

    if (integrationId === "upstash") {
      const redis = getRedis();
      if (!redis) return { status: "unknown", safeErrorCode: "MISSING_CONFIGURATION" };
      await redis.get("health:probe:read_only");
      return { status: "healthy", safeErrorCode: null };
    }

    if (integrationId === "stripe_billing" || integrationId === "stripe_identity") {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) return { status: "unknown", safeErrorCode: "MISSING_CONFIGURATION" };
      const response = await fetch("https://api.stripe.com/v1/checkout/sessions?limit=1", {
        headers: { Authorization: `Bearer ${key}` },
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) return { status: "healthy", safeErrorCode: null };
      return {
        status: "unhealthy",
        safeErrorCode: response.status === 401 || response.status === 403
          ? "STRIPE_CREDENTIAL_OR_SCOPE_REJECTED"
          : "STRIPE_API_UNAVAILABLE",
      };
    }

    if (integrationId === "twilio_sms") {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const token = process.env.TWILIO_AUTH_TOKEN;
      if (!sid || !token) return { status: "unknown", safeErrorCode: "MISSING_CONFIGURATION" };
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
        headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      });
      return response.ok
        ? { status: "healthy", safeErrorCode: null }
        : { status: "unhealthy", safeErrorCode: "TWILIO_API_REJECTED" };
    }

    return { status: "unknown", safeErrorCode: "AUTOMATED_PROBE_NOT_AVAILABLE" };
  } catch (error) {
    const code = error instanceof DOMException && error.name === "TimeoutError"
      ? "PROBE_TIMEOUT"
      : "PROBE_FAILED";
    return { status: "unhealthy", safeErrorCode: code };
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ integrationId: string }> },
) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const access = await getAdminAccess();
  if (!access.ok) {
    const status = access.reason === "unauthenticated" ? 401 : access.reason === "mfa_required" ? 428 : 403;
    return NextResponse.json({ ok: false, error: access.reason.toUpperCase() }, { status });
  }

  const { integrationId } = await params;
  if (!INFRASTRUCTURE_REGISTRY.some((entry) => entry.id === integrationId)) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const startedAt = performance.now();
  const result = await probe(integrationId);
  const checkedAt = new Date();
  const expiresAt = new Date(checkedAt.getTime() + 5 * 60 * 1000);
  const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
  const service = await supabaseService();
  const { error } = await service.from("integration_health").upsert({
    integration_id: integrationId,
    status: result.status,
    checked_at: checkedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    latency_ms: latencyMs,
    safe_error_code: result.safeErrorCode,
    updated_at: checkedAt.toISOString(),
  });
  if (error) {
    return NextResponse.json({ ok: false, error: "HEALTH_WRITE_FAILED" }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        integrationId,
        status: result.status,
        checkedAt: checkedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        latencyMs,
        safeErrorCode: result.safeErrorCode,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
