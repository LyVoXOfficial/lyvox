"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = {
  initialMarketingOptIn: boolean;
  lastUpdated: string | null;
};

function formatTimestamp(value: string | null): string {
  if (!value) return "not recorded";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function ConsentSettings({ initialMarketingOptIn, lastUpdated }: Props) {
  const [marketingOptIn, setMarketingOptIn] = useState(initialMarketingOptIn);
  const [pending, startTransition] = useTransition();
  const [downloading, setDownloading] = useState(false);

  const statusLabel = useMemo(
    () => (marketingOptIn ? "Enabled" : "Disabled"),
    [marketingOptIn],
  );

  const toggleMarketing = (nextValue: boolean) => {
    startTransition(async () => {
      try {
        const response = await fetch("/api/profile/consents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ marketingOptIn: nextValue }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const errorCode = payload?.error ?? "CONSENT_UPDATE_FAILED";
          toast.error(
            errorCode === "SERVICE_ROLE_MISSING"
              ? "Consent service unavailable. Contact support."
              : "Unable to update consent preference.",
          );
          return;
        }

        setMarketingOptIn(nextValue);
        toast.success(
          nextValue ? "Marketing updates enabled." : "Marketing updates disabled.",
        );
      } catch {
        toast.error("Network error. Please try again.");
      }
    });
  };

  const downloadHistory = async () => {
    setDownloading(true);
    try {
      const response = await fetch("/api/profile/consents?format=download");
      if (!response.ok) {
        toast.error("Unable to generate consent history.");
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `lyvox-consents-${new Date().toISOString()}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Consent history exported.");
    } catch {
      toast.error("Download failed. Please retry.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="rounded-2xl border p-4 shadow-sm">
      <header className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Consent management</h2>
          <p className="text-sm text-zinc-600">
            Control marketing communications and export your full consent history.
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
          {statusLabel}
        </span>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <label className="flex items-center gap-3 text-sm text-zinc-700">
          <input
            type="checkbox"
            className="h-5 w-5 rounded border-zinc-300"
            checked={marketingOptIn}
            onChange={(event) => toggleMarketing(event.target.checked)}
            disabled={pending}
          />
          <span>
            Receive marketplace updates, surveys, and partner offers via email.
            <span className="block text-xs text-zinc-500">
              Last updated: {formatTimestamp(lastUpdated)}
            </span>
          </span>
        </label>
        <Button type="button" onClick={downloadHistory} disabled={downloading}>
          {downloading ? "Exporting..." : "Export history"}
        </Button>
      </div>
    </section>
  );
}
