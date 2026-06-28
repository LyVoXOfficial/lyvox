import "server-only";
import { supabaseService } from "@/lib/supabaseService";
import type { Json } from "@/lib/supabaseTypes";
import type { AnalyticsEventName } from "./events";

interface TrackOptions {
  userId?: string;
  sessionId?: string;
  dedupKey?: string;
}

/**
 * Write an analytics event from server-side code (API routes, Server Components).
 * Non-critical: errors are logged but never propagated to the caller.
 *
 * @param eventName - canonical event name from ANALYTICS_EVENTS
 * @param props     - event-specific payload (see events.ts JSDoc per event)
 * @param opts      - optional userId, sessionId, dedupKey for deduplication
 */
export async function trackServerEvent(
  eventName: AnalyticsEventName,
  props: Record<string, unknown> = {},
  opts: TrackOptions = {},
): Promise<void> {
  try {
    const service = await supabaseService();
    const { error } = await service.from("analytics_events").upsert(
      {
        event_name: eventName,
        user_id: opts.userId ?? null,
        session_id: opts.sessionId ?? null,
        props: props as Json,
        // B3: server keys are namespaced 's:' so they can never be pre-empted by
        // client-supplied 'c:' keys from POST /api/analytics/track.
        dedup_key: opts.dedupKey ? `s:${opts.dedupKey}` : null,
      },
      {
        onConflict: "dedup_key",
        ignoreDuplicates: true,
      },
    );

    if (error) {
      console.error(`[analytics] Failed to track ${eventName}:`, error.message);
    }
  } catch (err) {
    // Best-effort: never crash the calling route
    console.error(`[analytics] Unexpected error tracking ${eventName}:`, err);
  }
}
