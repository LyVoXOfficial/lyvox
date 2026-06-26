import { supabaseService } from "@/lib/supabaseService";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/lib/apiErrors";
import enMessages from "@/i18n/locales/en.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stage 5: scheduled saved-search alert delivery. Triggered by Vercel Cron (vercel.json) with an
// `Authorization: Bearer ${CRON_SECRET}` header. Until CRON_SECRET is set in the env, the route is
// fail-closed (401) and alerts simply don't fire — the rest of the saved-search feature is unaffected.

const SCAN = 100;
const CONCURRENCY = 5;

type Filters = {
  category_id?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  location?: string | null;
  verified_only?: boolean | null;
  condition?: string | null;
  sort_by?: string | null;
};

function interpolate(tpl: string, params: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? String(params[k]) : m));
}

function searchHref(query: string | null, f: Filters): string {
  const p = new URLSearchParams();
  if (query) p.set("q", query);
  if (f.category_id) p.set("category_id", f.category_id);
  if (f.price_min != null) p.set("price_min", String(f.price_min));
  if (f.price_max != null) p.set("price_max", String(f.price_max));
  if (f.location) p.set("location", f.location);
  if (f.verified_only) p.set("verified_only", "true");
  if (f.condition) p.set("condition", f.condition);
  if (f.sort_by) p.set("sort_by", f.sort_by);
  return `/search?${p.toString()}`;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401, detail: "Cron auth required" });
  }

  const supabase = await supabaseService();
  const { data: searches, error } = await supabase
    .from("saved_searches")
    .select("*")
    .eq("alert_enabled", true);
  if (error) return createErrorResponse(ApiErrorCode.FETCH_FAILED, { status: 500, detail: error.message });

  const messages = enMessages as Record<string, { alert_title?: string; alert_body?: string }>;
  const titleTpl = messages.saved?.alert_title ?? "New matches: {name}";
  const bodyTpl = messages.saved?.alert_body ?? "{count} new listing(s) match your saved search.";

  const rows = searches ?? [];
  let notified = 0;

  await mapWithConcurrency(rows, CONCURRENCY, async (s) => {
    const f = (s.filters ?? {}) as Filters;
    // Capture the boundary BEFORE the scan; we alert on adverts in (last_alerted_at, runStartedAt]
    // and advance the watermark to runStartedAt. This window bound avoids both missing adverts
    // created during the scan and re-alerting them on the next run.
    const runStartedAt = new Date();
    const { data: ads, error: rpcErr } = await supabase.rpc("search_adverts", {
      search_query: s.query ?? undefined,
      category_id_filter: f.category_id ?? undefined,
      price_min_filter: f.price_min ?? undefined,
      price_max_filter: f.price_max ?? undefined,
      location_filter: f.location ?? undefined,
      sort_by: "created_at_desc",
      page_offset: 0,
      page_limit: SCAN,
      verified_only: f.verified_only ?? false,
      condition_filter: f.condition ?? undefined,
    });
    // On a transient scan failure, do NOT advance the watermark — retry the whole window next run.
    if (rpcErr) return;

    const sinceMs = new Date(s.last_alerted_at).getTime();
    const untilMs = runStartedAt.getTime();
    const fresh = (Array.isArray(ads) ? (ads as Array<{ created_at?: string | null }>) : []).filter((a) => {
      if (a.created_at == null) return false;
      const t = new Date(a.created_at).getTime();
      return t > sinceMs && t <= untilMs;
    });

    if (fresh.length > 0) {
      const { error: insertErr } = await supabase.from("notifications").insert({
        user_id: s.user_id,
        type: "saved_search",
        channel: "in_app",
        title: interpolate(titleTpl, { name: s.name }),
        body: interpolate(bodyTpl, { count: fresh.length }),
        payload: { saved_search_id: s.id, count: fresh.length, href: searchHref(s.query ?? null, f) },
      });
      // Insert failed → don't advance; the same window is retried (and delivered) next run.
      if (insertErr) {
        console.error("saved-search alert insert failed", { saved_search_id: s.id, error: insertErr.message });
        return;
      }
      notified++;
    }

    const { error: updErr } = await supabase
      .from("saved_searches")
      .update({ last_alerted_at: runStartedAt.toISOString() })
      .eq("id", s.id);
    if (updErr) {
      console.error("saved-search watermark update failed", { saved_search_id: s.id, error: updErr.message });
    }
  });

  return createSuccessResponse({ processed: rows.length, notified });
}
