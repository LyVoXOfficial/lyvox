"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { trackEvent } from "@/lib/discover/discoverTrack";
import { cn } from "@/lib/utils";

export type DiscoverMode = "standard" | "simple" | "buttons";

export type DiscoverPrefs = {
  mode: DiscoverMode;
  haptics: boolean;
  ask_reason_down: boolean;
  confirm_actions: boolean;
};

export const DEFAULT_PREFS: DiscoverPrefs = {
  mode: "standard",
  haptics: true,
  ask_reason_down: true,
  confirm_actions: false,
};

const MODES: DiscoverMode[] = ["standard", "simple", "buttons"];

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          value ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform",
            value ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}

async function savePrefsToServer(prefs: DiscoverPrefs): Promise<void> {
  try {
    await fetch("/api/profile/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discover_prefs: prefs }),
    });
  } catch {
    /* non-fatal — prefs are kept in localStorage */
  }
}

export default function DiscoverSettings({
  open,
  prefs,
  onClose,
  onSave,
}: {
  open: boolean;
  prefs: DiscoverPrefs;
  onClose: () => void;
  onSave: (p: DiscoverPrefs) => void;
}) {
  const { t } = useI18n();
  const [local, setLocal] = useState<DiscoverPrefs>(prefs);

  function handleSave() {
    onSave(local);
    void savePrefsToServer(local);
    trackEvent({
      event_name: "discover_prefs_changed",
      props: { mode: local.mode, haptics: local.haptics, ask_reason_down: local.ask_reason_down, confirm_actions: local.confirm_actions },
    });
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{t("discover.settings.title")}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4 pb-4">
          {/* Mode selection */}
          <div>
            <p className="mb-2 text-sm font-medium">{t("discover.settings.mode")}</p>
            <div className="flex gap-2 flex-wrap">
              {MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setLocal((p) => ({ ...p, mode: m }))}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm transition",
                    local.mode === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary/40",
                  )}
                >
                  {t(`discover.settings.${m}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <Toggle
            value={local.haptics}
            onChange={(v) => setLocal((p) => ({ ...p, haptics: v }))}
            label={t("discover.settings.haptics")}
          />
          <Toggle
            value={local.ask_reason_down}
            onChange={(v) => setLocal((p) => ({ ...p, ask_reason_down: v }))}
            label={t("discover.settings.ask_reason")}
          />
          <Toggle
            value={local.confirm_actions}
            onChange={(v) => setLocal((p) => ({ ...p, confirm_actions: v }))}
            label={t("discover.settings.confirm_actions")}
          />

          <Button className="w-full" onClick={handleSave}>
            {t("common.save")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
