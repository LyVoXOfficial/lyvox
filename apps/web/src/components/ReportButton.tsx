"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Flag, X } from "lucide-react";

import { apiFetch, RateLimitedError } from "@/lib/fetcher";
import { useI18n } from "@/i18n";

type Props = {
  advertId: string;
};

export default function ReportButton({ advertId }: Props) {
  const { t } = useI18n();
  const tr = (key: string, fallback: string, params?: Record<string, string | number>) => {
    const value = t(key, params);
    return value === key ? fallback : value;
  };
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("fraud");
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const close = useCallback(() => {
    setOpen(false);
    setMessage(null);
    setSubmitting(false);
  }, []);

  const submit = async () => {
    if (submitting || cooldown > 0) return;
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await apiFetch("/api/reports/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advert_id: advertId, reason, details }),
        credentials: "include",
      });

      const payload = await response.json().catch(() => ({ ok: false }));

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || response.statusText);
      }

      setMessage(tr("report.success", "Report submitted. Thank you."));
      setTimeout(() => close(), 1000);
    } catch (error) {
      if (error instanceof RateLimitedError) {
        const seconds = Math.max(1, Math.round(error.retryAfterSec ?? 60));
        setCooldown(seconds);
        toast.error(
          tr("report.too_many_attempts", `Too many attempts. Try again in ${seconds}s.`, { seconds }),
        );
      } else {
        const text =
          error instanceof Error ? error.message : tr("report.submit_error", "Could not submit the report");
        setMessage(tr("report.error_prefix", `Error: ${text}`, { message: text }));
      }
      setSubmitting(false);
    }
  };

  const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={tr("report.button", "Report")}
        title={tr("report.button", "Report")}
        className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <Flag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">{tr("report.button", "Report")}</span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-extrabold tracking-tight">{tr("report.title", "Report listing")}</h3>
              <button
                type="button"
                onClick={close}
                className="rounded-xl p-2 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">{tr("report.close", "Close")}</span>
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
                  {tr("report.reason_label", "Reason")}
                </label>
                <select
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-4 focus:ring-primary/12"
                >
                  <option value="fraud">{tr("report.reasons.fraud", "Fraud or phishing")}</option>
                  <option value="spam">{tr("report.reasons.spam", "Spam")}</option>
                  <option value="duplicate">{tr("report.reasons.duplicate", "Duplicate listing")}</option>
                  <option value="nsfw">{tr("report.reasons.nsfw", "Unsafe content")}</option>
                  <option value="other">{tr("report.reasons.other", "Other")}</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
                  {tr("report.details_label", "Details (optional)")}
                </label>
                <textarea
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-4 focus:ring-primary/12"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                onClick={submit}
                disabled={submitting || cooldown > 0}
                className="rounded-xl bg-primary px-4 py-2 font-medium text-primary-foreground shadow-[var(--shadow-soft)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? tr("report.submitting", "Submitting...")
                  : cooldown > 0
                    ? tr("report.retry_in", `Retry in ${cooldown}s`, { seconds: cooldown })
                    : tr("report.submit", "Submit report")}
              </button>
              <button
                type="button"
                onClick={close}
                className="rounded-xl border border-border px-4 py-2 font-medium"
              >
                {tr("common.cancel", "Cancel")}
              </button>
            </div>

            {message && (
              <p className="mt-3 text-sm text-muted-foreground">{message}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
