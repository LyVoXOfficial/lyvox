"use client";

import { useI18n } from "@/i18n";

/** Shield-check SVG (matches the mockup verified signal icon) */
const ShieldCheckIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
    <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

/** Triangle-warning SVG (anti-fraud icon) */
const AlertTriangleIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
    <path d="M12 3l9 16H3z" />
    <path d="M12 10v4M12 17v.4" />
  </svg>
);

/** Star SVG (Made for Belgium icon) */
const StarIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
    <path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" />
  </svg>
);

export default function TopBar() {
  const { t } = useI18n();

  const signals = [
    { Icon: ShieldCheckIcon, label: t("topbar.verified_signals") },
    { Icon: AlertTriangleIcon, label: t("topbar.anti_scam") },
    { Icon: StarIcon, label: t("topbar.belgian_deals") },
  ];

  return (
    <>
      {/* Desktop trust ribbon */}
      <div className="hidden w-full border-b border-border bg-secondary text-xs text-muted-foreground md:block">
        <div className="mx-auto flex h-[38px] max-w-[1200px] items-center justify-between px-6">
          <span className="font-semibold text-foreground">LyVoX Belgium</span>
          <div className="flex items-center gap-[22px]">
            {signals.map(({ Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5 whitespace-nowrap text-primary">
                <Icon />
                <span className="text-muted-foreground">{label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile trust ribbon — the desktop TopBar is hidden on phones (the main
          channel), which stripped the trust context. This compact, non-sticky
          strip restores it. Centered wrap so all three signals stay readable
          even in longer locales (nl/fr/de) instead of scrolling out of view. */}
      <div className="w-full border-b border-border bg-secondary text-[11px] text-muted-foreground md:hidden">
        <div className="mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-1.5">
          {signals.map(({ Icon, label }) => (
            <span key={label} className="inline-flex items-center gap-1 whitespace-nowrap text-primary">
              <Icon />
              <span className="text-muted-foreground">{label}</span>
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
