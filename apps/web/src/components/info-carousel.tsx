"use client";

import Link from "next/link";
import { ArrowRight, BadgeEuro, MessageCircleWarning, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n";

export default function InfoCarousel() {
  const { t } = useI18n();
  const items = [
    {
      title: t("infocards.verified_title"),
      body: t("infocards.verified_body"),
      link: "/search?verified_only=true",
      action: t("infocards.verified_action"),
      icon: ShieldCheck,
    },
    {
      title: t("infocards.payment_title"),
      body: t("infocards.payment_body"),
      link: "/profile/billing",
      action: t("infocards.payment_action"),
      icon: BadgeEuro,
    },
    {
      title: t("infocards.report_title"),
      body: t("infocards.report_body"),
      link: "/contact",
      action: t("infocards.report_action"),
      icon: MessageCircleWarning,
    },
  ];
  return (
    <div className="overflow-x-auto">
      <div className="flex snap-x snap-mandatory gap-3 pr-4">
        {items.map((it) => {
          const Icon = it.icon;

          return (
            <Link
              key={it.title}
              href={it.link}
              className="group snap-start min-w-[280px] rounded-xl border border-border/70 bg-card p-5 shadow-[var(--shadow-soft)] transition duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[var(--shadow-card)] md:min-w-[340px]"
            >
              <span className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl bg-accent/40 text-accent-foreground transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-[22px] w-[22px]" aria-hidden="true" />
              </span>
              <div className="text-[15px] font-bold tracking-tight">{it.title}</div>
              <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted-foreground">{it.body}</p>
              <span className="mt-3.5 inline-flex items-center gap-1.5 text-[13px] font-bold text-primary">
                {it.action}
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
