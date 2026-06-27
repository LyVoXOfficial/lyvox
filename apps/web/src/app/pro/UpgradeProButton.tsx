"use client";

import { useState } from "react";
import { I18nProvider, useI18n } from "@/i18n";
import type { Locale } from "@/i18n";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/fetcher";
import { toast } from "sonner";
import { Loader2, Zap } from "lucide-react";

// ---- Inner button (needs I18n context) ----------------------------------------

type Variant = "default" | "amber" | "white";

function UpgradeProButtonInner({ variant = "default" }: { variant?: Variant }) {
  const { t } = useI18n();
  const tr = (key: string, fallback: string): string => {
    const val = t(key);
    return val === key ? fallback : val;
  };

  const [isPending, setIsPending] = useState(false);

  const handleClick = async () => {
    setIsPending(true);
    try {
      const response = await apiFetch("/api/billing/subscribe", { method: "POST" });
      const result: { ok: boolean; data?: { url?: string }; error?: string; detail?: string } =
        await response.json();

      if (!result.ok || !result.data?.url) {
        toast.error(tr("pro.cabinet.upgrade.error", "Could not start upgrade. Please try again."), {
          description: result.detail ?? result.error,
        });
        return;
      }

      window.location.href = result.data.url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      toast.error(tr("pro.cabinet.upgrade.error", "Could not start upgrade. Please try again."), {
        description: message,
      });
    } finally {
      setIsPending(false);
    }
  };

  // ── Amber variant: the header CTA button (amber gradient, dark text) ──────
  if (variant === "amber") {
    return (
      <button
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex h-[46px] items-center gap-2 rounded-[var(--rm)] border-0 px-5 text-[14px] font-extrabold disabled:opacity-70"
        style={{
          background: "linear-gradient(135deg, var(--amber), oklch(0.74 0.15 55))",
          color: "oklch(0.26 0.10 50)",
          boxShadow: "0 4px 14px oklch(0.78 0.14 60 / 0.4)",
        }}
      >
        {isPending ? (
          <Loader2 className="h-[17px] w-[17px] animate-spin" aria-hidden="true" />
        ) : (
          <Zap className="h-[17px] w-[17px] fill-current" aria-hidden="true" />
        )}
        {tr("pro.cabinet.upgrade.cta", "Upgrade to Pro")}
      </button>
    );
  }

  // ── White variant: inside the gradient card (white bg, --priD text) ────────
  if (variant === "white") {
    return (
      <button
        onClick={handleClick}
        disabled={isPending}
        className="flex h-[42px] w-full items-center justify-center rounded-[var(--rm)] border-0 text-[13.5px] font-extrabold disabled:opacity-70"
        style={{
          background: "#fff",
          color: "var(--priD)",
        }}
      >
        {isPending && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        )}
        {tr("pro.cabinet.upgrade.cta", "Upgrade to Pro")}
      </button>
    );
  }

  // ── Default variant: standard Button component ────────────────────────────
  return (
    <Button onClick={handleClick} disabled={isPending}>
      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
      {tr("pro.cabinet.upgrade.cta", "Upgrade to Pro")}
    </Button>
  );
}

// ---- Public wrapper (provides I18n context) ------------------------------------

type Props = {
  locale: Locale;
  messages: Record<string, unknown>;
  variant?: Variant;
};

export function UpgradeProButton({ locale, messages, variant }: Props) {
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <I18nProvider locale={locale} messages={messages as Record<string, any>}>
      <UpgradeProButtonInner variant={variant} />
    </I18nProvider>
  );
}
