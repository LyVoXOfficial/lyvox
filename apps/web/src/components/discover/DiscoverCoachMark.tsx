"use client";

import { useEffect, useRef } from "react";
import { ChevronRight, ChevronLeft, ChevronUp, ChevronDown, MousePointer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { setSectionState } from "@/lib/discover/navHelp";
import { trackEvent } from "@/lib/discover/discoverTrack";

const STEPS = [
  { icon: ChevronRight, keyI18n: "coach.right", color: "text-emerald-400" },
  { icon: ChevronLeft, keyI18n: "coach.left", color: "text-rose-400" },
  { icon: ChevronUp, keyI18n: "coach.up", color: "text-sky-400" },
  { icon: ChevronDown, keyI18n: "coach.down", color: "text-purple-400" },
  { icon: MousePointer, keyI18n: "coach.tap", color: "text-white" },
] as const;

/**
 * One-time discover coach-mark overlay. Uses PRD 61 unified nav-help storage:
 * `lyvox:nav-help → sections.discover`. Shown on first visit; re-openable via "?" button.
 */
export default function DiscoverCoachMark({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useI18n();
  const ctaRef = useRef<HTMLButtonElement>(null);

  // Trap focus inside the overlay
  useEffect(() => {
    ctaRef.current?.focus();
    const prev = document.activeElement as HTMLElement | null;
    return () => {
      prev?.focus?.();
    };
  }, []);

  // Keyboard: Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDismiss() {
    setSectionState("discover", "completed");
    trackEvent({ event_name: "discover_coachmark_dismissed" });
    onDismiss();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("discover.coach.title")}
      className="absolute inset-0 z-50 flex flex-col items-center justify-end rounded-2xl bg-black/75 pb-6"
      onClick={handleDismiss}
    >
      <div
        className="w-full max-w-xs rounded-2xl bg-card/95 p-5 shadow-2xl backdrop-blur-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-center text-base font-semibold">{t("discover.coach.title")}</h2>
        <ul className="space-y-3">
          {STEPS.map(({ icon: Icon, keyI18n, color }) => (
            <li key={keyI18n} className="flex items-center gap-3">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted ${color}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-sm">{t(`discover.${keyI18n}`)}</span>
            </li>
          ))}
        </ul>
        <Button
          ref={ctaRef}
          className="mt-5 w-full"
          onClick={handleDismiss}
          aria-label={t("discover.coach.cta")}
        >
          {t("discover.coach.cta")}
        </Button>
      </div>
    </div>
  );
}
