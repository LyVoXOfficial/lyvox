import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import {
  createSuccessResponse,
  createErrorResponse,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";
import { ANALYTICS_EVENTS, DEAL_STUB_EVENTS, type AnalyticsEventName } from "@/lib/analytics/events";
import { withCsrfProtection } from "@/lib/security/csrf";

export const runtime = "nodejs";

const VALID_EVENT_NAMES = new Set<string>(Object.values(ANALYTICS_EVENTS));

// B2: props size-bounded to prevent DB bloat (max 20 keys, string values ≤512 chars)
const propValueSchema = z.union([
  z.string().max(512),
  z.number(),
  z.boolean(),
  z.null(),
]);

const eventSchema = z.object({
  event_name: z.string().refine((v) => VALID_EVENT_NAMES.has(v), {
    message: "Unknown event_name",
  }),
  session_id: z.string().min(1).max(128).optional(),
  props: z.record(z.string().max(64), propValueSchema)
    .refine((obj) => Object.keys(obj).length <= 20, { message: "Too many props keys (max 20)" })
    .optional(),
  // B3: client keys are namespaced with 'c:' to prevent collision with server 's:' keys
  dedup_key: z.string().max(248).optional(),
});

const analyticsLimiter = createRateLimiter({
  limit: 120,
  windowSec: 60,
  prefix: "analytics:track",
});

async function handleTrack(req: Request) {
  const parseResult = await safeJsonParse<unknown>(req);
  if (!parseResult.success) return parseResult.response;

  const validation = eventSchema.safeParse(parseResult.data);
  if (!validation.success) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: validation.error.issues[0]?.message ?? "Invalid event",
    });
  }

  const { event_name, session_id, props = {}, dedup_key } = validation.data;

  // Silently drop F3-gated stub events sent from the client
  if (DEAL_STUB_EVENTS.has(event_name as AnalyticsEventName)) {
    return createSuccessResponse({ tracked: false, reason: "event_not_live" });
  }

  // Get user_id for attribution; use service role for the insert so guests (anon role)
  // can write events — the analytics_events RLS only allows `authenticated` role but
  // Discover is open to guests who are the primary audience (PRD 01).
  const cookieClient = await supabaseServer();
  const { data: { user } } = await cookieClient.auth.getUser();
  const svc = await supabaseService();

  // B3: prefix client-supplied dedup_key with 'c:' so it never collides with
  // server-written keys (prefixed 's:' by trackServerEvent). Prevents a
  // authenticated client from pre-empting server funnel events.
  const storedDedupKey = dedup_key ? `c:${dedup_key}` : null;

  const { error } = await svc.from("analytics_events").upsert(
    {
      event_name,
      user_id: user?.id ?? null,
      session_id: session_id ?? null,
      props,
      dedup_key: storedDedupKey,
    },
    {
      onConflict: "dedup_key",
      ignoreDuplicates: true,
    },
  );

  if (error) {
    console.error("[analytics] Track insert failed:", error.message);
    return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, { status: 500 });
  }

  return createSuccessResponse({ tracked: true });
}

export const POST = withRateLimit(withCsrfProtection(handleTrack), {
  limiter: analyticsLimiter,
  makeKey: (_req, _userId, ip) => ip ?? "anonymous",
});
