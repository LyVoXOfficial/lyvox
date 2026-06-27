"use client";

import { useState } from "react";
import { I18nProvider, useI18n } from "@/i18n";
import type { Locale } from "@/i18n";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/fetcher";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

// ---- Inner button (needs I18n context) ----------------------------------------

function UpgradeProButtonInner() {
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
};

export function UpgradeProButton({ locale, messages }: Props) {
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <I18nProvider locale={locale} messages={messages as Record<string, any>}>
      <UpgradeProButtonInner />
    </I18nProvider>
  );
}
