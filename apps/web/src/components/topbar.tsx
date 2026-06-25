"use client";

import { ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { useI18n } from "@/i18n";

export default function TopBar() {
  const { t } = useI18n();
  const signals = [
    {
      icon: ShieldCheck,
      label: t("topbar.verified_signals"),
    },
    {
      icon: TriangleAlert,
      label: t("topbar.anti_scam"),
    },
    {
      icon: Sparkles,
      label: t("topbar.belgian_deals"),
    },
  ];

  return (
    <div className="hidden w-full border-b border-border/70 bg-secondary/70 text-xs text-secondary-foreground md:block">
      <div className="mx-auto flex h-8 max-w-7xl items-center justify-between px-4">
        <span className="font-medium tracking-wide">LyVoX Belgium</span>
        <div className="flex items-center gap-5">
          {signals.map(({ icon: Icon, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
              <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
