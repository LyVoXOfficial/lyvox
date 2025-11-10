"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import AdCard from "@/components/ad-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

export type SelectableAd = {
  id: string;
  title: string;
  price?: number | null;
  currency?: string | null;
  location?: string | null;
  image?: string | null;
  createdAt?: string | null;
  sellerVerified?: boolean;
};

type Props = {
  items: SelectableAd[];
  maxSelection?: number;
  onCompare: (selectedIds: string[]) => void;
  isLoading?: boolean;
};

export default function SelectableAdsGrid({
  items,
  maxSelection = 4,
  onCompare,
  isLoading = false,
}: Props) {
  const { t } = useI18n();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showPulse, setShowPulse] = useState(true);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedCount = selectedIds.length;
  const selectionLimitReached = selectedCount >= maxSelection;
  const remainingSlots = Math.max(0, maxSelection - selectedCount);
  const showActionBar = selectedCount > 0;
  const compareDisabled = selectedCount < 2 || isLoading;

  useEffect(() => {
    if (selectedCount > 0) {
      setShowPulse(false);
      return;
    }

    setShowPulse(true);
    const timeout = window.setTimeout(() => setShowPulse(false), 2400);
    return () => window.clearTimeout(timeout);
  }, [selectedCount]);

  const toggleSelection = useCallback(
    (id: string, nextState: boolean) => {
      setSelectedIds((prev) => {
        const set = new Set(prev);
        if (nextState) {
          if (set.has(id) || set.size >= maxSelection) {
            return prev;
          }
          set.add(id);
        } else {
          set.delete(id);
        }
        return Array.from(set);
      });
    },
    [maxSelection],
  );

  const handleCompare = useCallback(() => {
    if (isLoading || selectedIds.length < 2) {
      return;
    }
    onCompare(selectedIds);
  }, [isLoading, onCompare, selectedIds]);

  const handleReset = useCallback(() => {
    setSelectedIds([]);
  }, []);

  if (!items.length) {
    return <p className="text-sm text-muted-foreground">{t("comparison.no_items")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("comparison.select_for_compare")}</p>
        <Badge variant="secondary" className="font-medium">
          {selectedCount} / {maxSelection}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item) => {
          const isSelected = selectedSet.has(item.id);
          const isDisabled = !isSelected && selectionLimitReached;
          const remainingAfterSelect = isSelected ? remainingSlots + 1 : remainingSlots;

          let tooltipMessage = t("comparison.tooltip_select");
          if (isDisabled) {
            tooltipMessage = t("comparison.tooltip_limit_reached");
          } else if (!isSelected && remainingAfterSelect > 0 && remainingAfterSelect <= 2) {
            tooltipMessage = t("comparison.tooltip_near_limit", { remaining: remainingAfterSelect });
          }

          return (
            <div key={item.id} className="relative">
              <div
                className={cn(
                  "rounded-lg border transition",
                  isSelected && "border-primary/60 ring-2 ring-primary/40",
                  isDisabled && "opacity-60",
                )}
              >
                <AdCard {...item} />
              </div>
              <div className="absolute right-2 top-2 z-10">
                <label
                  title={tooltipMessage}
                  className={cn(
                    "inline-flex items-center justify-center rounded-full border-2 border-white bg-white/90 p-1 shadow transition",
                    "hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                    "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
                    isDisabled && "cursor-not-allowed opacity-70",
                    showPulse && selectedCount === 0 && !isSelected && "animate-pulse",
                  )}
                >
                  <Checkbox
                    id={`compare-${item.id}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => toggleSelection(item.id, Boolean(checked))}
                    disabled={isDisabled}
                    className="h-7 w-7"
                    aria-label={tooltipMessage}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {showActionBar ? (
        <div className="sticky bottom-4 mt-8 flex flex-col items-center">
          <div className="flex w-full max-w-lg flex-col gap-2 rounded-2xl border bg-background/95 px-4 py-3 text-sm shadow-lg backdrop-blur">
            {selectedCount < 3 ? (
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                {t("comparison.help_tip")}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                {t("comparison.selected_count", { count: selectedCount })}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleReset} disabled={isLoading}>
                  {t("comparison.clear_selection")}
                </Button>
                <Button size="sm" onClick={handleCompare} disabled={compareDisabled}>
                  {isLoading
                    ? t("comparison.loading")
                    : t("comparison.compare_button", { count: selectedCount })}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
