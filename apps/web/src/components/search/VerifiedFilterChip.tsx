"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { localizeHref } from "@/lib/i18n";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type CountState = { verified: number | null; total: number | null };

/**
 * T14 item 4 — "Verified sellers only" promoted from the filter rail into a chip
 * above the results, with a live count preview "N of M" fetched BEFORE the filter
 * is applied. N = matches if verified-only were on; M = matches without it. Both
 * counts are real (limit=1, reading the RPC's total_count) — nothing is estimated.
 * Toggling updates the shared `verified_only` URL param (so the rail toggle stays
 * in sync) and logs to analytics_events (F6).
 */
export default function VerifiedFilterChip() {
  const { locale, t } = useI18n();
  const tr = useCallback(
    (key: string, fallback: string) => {
      const value = t(key);
      return value === key ? fallback : value;
    },
    [t],
  );
  const router = useRouter();
  const searchParams = useSearchParams();

  const isOn = (() => {
    const raw = searchParams.get("verified_only");
    if (!raw) return false;
    const n = raw.trim().toLowerCase();
    return n === "true" || n === "1" || n === "yes";
  })();

  const [counts, setCounts] = useState<CountState>({ verified: null, total: null });
  const reqIdRef = useRef(0);

  // Build a count-only query (limit=1) from the current params, minus paging and
  // the verified flag — we set that ourselves for each of the two counts.
  const countParamsFor = useCallback(
    (verified: boolean) => {
      const p = new URLSearchParams();
      searchParams.forEach((value, key) => {
        if (key === "page" || key === "limit" || key === "verified_only") return;
        p.set(key, value);
      });
      p.set("limit", "1");
      p.set("page", "0");
      p.set("instant", "1"); // higher-rate-limit bucket; these are typeahead-like prefetches
      if (verified) p.set("verified_only", "true");
      return p;
    },
    [searchParams],
  );

  useEffect(() => {
    const id = ++reqIdRef.current;
    let cancelled = false;
    setCounts({ verified: null, total: null });

    const fetchTotal = async (verified: boolean): Promise<number | null> => {
      try {
        const res = await fetch(`/api/search?${countParamsFor(verified).toString()}`);
        if (!res.ok) return null;
        const body = await res.json();
        if (!body?.ok || !body?.data) return null;
        return typeof body.data.total === "number" ? body.data.total : null;
      } catch {
        return null;
      }
    };

    void Promise.all([fetchTotal(true), fetchTotal(false)]).then(([verified, total]) => {
      if (cancelled || id !== reqIdRef.current) return;
      setCounts({ verified, total });
    });

    return () => {
      cancelled = true;
    };
  }, [countParamsFor]);

  const handleToggle = () => {
    const next = !isOn;
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("verified_only", "true");
    else params.delete("verified_only");
    params.set("page", "0");

    void fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: ANALYTICS_EVENTS.VERIFIED_FILTER_TOGGLED,
        props: {
          enabled: next,
          verified_count: counts.verified ?? -1,
          total_count: counts.total ?? -1,
        },
      }),
    }).catch(() => {});

    router.push(localizeHref(`/search?${params.toString()}`, locale));
  };

  const label = tr("search.verifiedOnlyChip", "Verified only");
  // Preview "N of M" — only when both real counts are known and there's something to preview.
  const preview =
    counts.verified !== null && counts.total !== null && counts.total > 0
      ? tr("search.verifiedPreview", "{verified} of {total}")
          .replace("{verified}", String(counts.verified))
          .replace("{total}", String(counts.total))
      : null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            role="switch"
            aria-checked={isOn}
            onClick={handleToggle}
            className="inline-flex items-center gap-1.5 font-semibold transition"
            style={{
              height: "30px",
              padding: "0 12px",
              borderRadius: "999px",
              fontSize: "12.5px",
              background: isOn ? "oklch(0.56 0.13 178 / 0.12)" : "var(--card)",
              border: isOn ? "none" : "1px solid var(--border)",
              color: isOn ? "var(--priD)" : "var(--foreground)",
            }}
          >
            <ShieldCheck
              className="h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
              style={{ color: isOn ? "var(--primary)" : "var(--muted-foreground)" }}
            />
            {label}
            {preview ? (
              <span className="font-medium text-muted-foreground">· {preview}</span>
            ) : null}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[240px] text-xs">
          {tr(
            "search.verifiedOnlyHelper",
            "Show listings only from sellers with verified email and phone",
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
