"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

interface TrustScoreRefreshButtonProps {
  refreshCta: string;
  refreshingLabel: string;
  refreshSuccess: string;
  refreshErrorRate: string;
  refreshError: string;
}

type State = "idle" | "loading" | "success" | "error" | "rate_limited";

export function TrustScoreRefreshButton({
  refreshCta,
  refreshingLabel,
  refreshSuccess,
  refreshErrorRate,
  refreshError,
}: TrustScoreRefreshButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [retryAfterMin, setRetryAfterMin] = useState<number | null>(null);

  async function handleRefresh() {
    if (state === "loading") return;
    setState("loading");
    setRetryAfterMin(null);

    try {
      const res = await fetch("/api/trust/refresh", { method: "POST" });

      if (res.ok) {
        router.refresh();
        setState("success");
        setTimeout(() => setState("idle"), 2000);
      } else if (res.status === 429) {
        const retryAfterSec = parseInt(res.headers.get("Retry-After") ?? "3600", 10);
        setRetryAfterMin(Math.ceil(retryAfterSec / 60));
        setState("rate_limited");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }

  const buttonStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "7px 14px",
    borderRadius: "var(--r)",
    fontSize: "13px",
    fontWeight: 600,
    cursor: state === "loading" ? "not-allowed" : "pointer",
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--priD)",
    opacity: state === "loading" ? 0.7 : 1,
    width: "100%",
    justifyContent: "center",
  };

  return (
    <div style={{ marginTop: "12px" }}>
      <button
        onClick={handleRefresh}
        disabled={state === "loading"}
        style={buttonStyle}
        type="button"
      >
        {state === "loading" ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {refreshingLabel}
          </>
        ) : (
          <>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {refreshCta}
          </>
        )}
      </button>

      {state === "success" && (
        <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--priD)", fontWeight: 500, textAlign: "center" }}>
          {refreshSuccess}
        </p>
      )}
      {state === "rate_limited" && retryAfterMin !== null && (
        <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--muted-foreground)", textAlign: "center" }}>
          {refreshErrorRate.replace("{min}", String(retryAfterMin))}
        </p>
      )}
      {state === "error" && (
        <p style={{ marginTop: "6px", fontSize: "12px", color: "oklch(0.55 0.18 25)", textAlign: "center" }}>
          {refreshError}
        </p>
      )}
    </div>
  );
}
