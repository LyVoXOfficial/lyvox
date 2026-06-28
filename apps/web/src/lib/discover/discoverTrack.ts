// Lightweight batched analytics client for Discover events.
// Buffers events and flushes to /api/analytics/track every 2 s or on demand.
// Gates on analytics consent — no events are sent if user declined analytics cookies.

import { hasConsent } from "@/lib/cookieConsent/store";

const SESSION_KEY = "lyvox:discover:session";
let _sessionId: string | null = null;

export function getDiscoverSessionId(): string {
  if (_sessionId) return _sessionId;
  if (typeof window === "undefined") return "";
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      _sessionId = stored;
      return stored;
    }
    const id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
    _sessionId = id;
    return id;
  } catch {
    if (!_sessionId) _sessionId = crypto.randomUUID();
    return _sessionId;
  }
}

export type TrackEvent = {
  event_name: string;
  props?: Record<string, unknown>;
  dedup_key?: string;
};

const _batch: TrackEvent[] = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

function flushBatch(): void {
  if (!_batch.length) return;
  if (!hasConsent("analytics")) {
    _batch.length = 0;
    return;
  }
  const events = _batch.splice(0);
  const sessionId = getDiscoverSessionId();
  void fetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      events: events.map((e) => ({ ...e, session_id: sessionId })),
    }),
    keepalive: true,
  }).catch(() => null);
}

export function trackEvent(event: TrackEvent): void {
  if (typeof window === "undefined") return;
  _batch.push(event);
  if (_flushTimer) clearTimeout(_flushTimer);
  _flushTimer = setTimeout(flushBatch, 2000);
}

export function flushEvents(): void {
  if (_flushTimer) {
    clearTimeout(_flushTimer);
    _flushTimer = null;
  }
  flushBatch();
}
