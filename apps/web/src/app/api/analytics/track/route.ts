import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  createSuccessResponse,
  createErrorResponse,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";
import { ANALYTICS_EVENTS, DEAL_STUB_EVENTS, type AnalyticsEventName } from "@/lib/analytics/events";

export const runtime = "nodejs";

const VALID_EVENT_NAMES = new Set<string>(Object.values(ANALYTICS_EVENTS));

const eventSchema = z.object({
  event_name: z.string().refine((v) => VALID_EVENT_NAMES.has(v), {
    message: "Unknown event_name",
  }),
  session_id: z.string().min(1).max(128).optional(),
  // z.record in Zod v4 requires explicit key type
  props: z.record(z.string(), z.unknown()).optional(),
  dedup_key: z.string().max(255).optional(),
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

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- analytics_events not yet in generated types; remove after pnpm gen:types
  const { error } = await (supabase as any).from("analytics_events").upsert(
    {
      event_name,
      user_id: user?.id ?? null,
      session_id: session_id ?? null,
      props,
      dedup_key: dedup_key ?? null,
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

export const POST = withRateLimit(handleTrack, {
  limiter: analyticsLimiter,
  makeKey: (_req, _userId, ip) => ip ?? "anonymous",
});
