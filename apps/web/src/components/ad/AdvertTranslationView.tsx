"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Languages } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

type TranslationViewContextValue = {
  enabled: boolean;
  showOriginal: boolean;
  setShowOriginal: (showOriginal: boolean) => void;
};

const TranslationViewContext = createContext<TranslationViewContextValue | null>(null);

function useTranslationView() {
  const value = useContext(TranslationViewContext);
  if (!value) {
    return {
      enabled: false,
      showOriginal: true,
      setShowOriginal: () => undefined,
    };
  }
  return value;
}

export function AdvertTranslationProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const value = useMemo(
    () => ({ enabled, showOriginal, setShowOriginal }),
    [enabled, showOriginal],
  );

  return (
    <TranslationViewContext.Provider value={value}>
      {children}
    </TranslationViewContext.Provider>
  );
}

export function AdvertTranslatedTitle({
  original,
  translated,
}: {
  original: string;
  translated: string | null | undefined;
}) {
  const { enabled, showOriginal } = useTranslationView();
  return <>{enabled && !showOriginal && translated ? translated : original}</>;
}

export function AdvertTranslatedDescription({
  original,
  translated,
  emptyLabel,
}: {
  original: string | null | undefined;
  translated: string | null | undefined;
  emptyLabel: string;
}) {
  const { enabled, showOriginal } = useTranslationView();
  const text = enabled && !showOriginal ? translated : original;
  return <>{text ?? emptyLabel}</>;
}

export function AdvertTranslationControls({
  badgeLabel,
  showOriginalLabel,
}: {
  badgeLabel: string;
  showOriginalLabel: string;
}) {
  const { enabled, showOriginal, setShowOriginal } = useTranslationView();
  if (!enabled) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="secondary" className="bg-amber-50 text-amber-900">
        <Languages className="h-3 w-3" aria-hidden="true" />
        {badgeLabel}
      </Badge>
      <label className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Switch
          checked={showOriginal}
          onCheckedChange={setShowOriginal}
          aria-label={showOriginalLabel}
        />
        <span>{showOriginalLabel}</span>
      </label>
    </div>
  );
}
