"use client";

import { useMemo, useState } from "react";
import AdCard from "@/components/ad-card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
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

export default function SelectableAdsGrid({ items, maxSelection = 4, onCompare, isLoading = false }: Props) {
  const { t } = useI18n();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectionLimitReached = selectedIds.length >= maxSelection;
  const showActionBar = selectedIds.length >= 2;

  const toggleSelection = (id: string, nextState: boolean) => {
    setSelectedIds((prev) => {
      const set = new Set(prev);
      if (nextState) {
        if (set.has(id)) {
          return prev;
        }
        if (set.size >= maxSelection) {
          return prev;
        }
        set.add(id);
      } else {
        set.delete(id);
      }
      return Array.from(set);
    });
  };

  const handleCompare = () => {
    if (isLoading) return;
    if (selectedIds.length >= 2) {
      onCompare(selectedIds);
    }
  };

  const handleReset = () => {
    setSelectedIds([]);
  };

  if (!items.length) {
    return <p className="text-sm text-muted-foreground">{t("comparison.no_items")}</p>;
  }

  return (
    <div className="relative">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item) => {
          const isSelected = selectedSet.has(item.id);
          const isDisabled = !isSelected && selectionLimitReached;

          return (
            <div key={item.id} className="relative">
              <div
                className={cn(
                  "rounded-lg border transition",
                  isSelected && "ring-2 ring-primary border-primary/50",
                  isDisabled && "opacity-60",
                )}
              >
                <AdCard {...item} />
              </div>
              <label
                className={cn(
                  "absolute left-3 top-3 z-20 inline-flex items-center gap-2",
                  isDisabled && "cursor-not-allowed",
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => toggleSelection(item.id, Boolean(checked))}
                  disabled={isDisabled}
                  aria-label={t("comparison.select_for_compare")}
                />
              </label>
            </div>
          );
        })}
      </div>

      {showActionBar ? (
        <div className="sticky bottom-4 mt-8 flex flex-col items-center">
          <div className="flex w-full max-w-lg items-center justify-between rounded-full border bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
            <div className="text-sm text-muted-foreground">
              {t("comparison.selected_count", { count: selectedIds.length })}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleReset} disabled={isLoading}>
                {t("comparison.clear_selection")}
              </Button>
              <Button size="sm" onClick={handleCompare} disabled={isLoading}>
                {isLoading
                  ? t("comparison.loading")
                  : t("comparison.compare_button", { count: selectedIds.length })}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
