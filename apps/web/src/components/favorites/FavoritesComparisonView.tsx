"use client";

import { useState, useCallback } from "react";

import SelectableAdsGrid, { type SelectableAd } from "@/components/comparison/SelectableAdsGrid";
import ComparisonTable from "@/components/comparison/ComparisonTable";
import { useI18n } from "@/i18n";
import type { ComparableAdvert } from "@/lib/types/comparison";
import { cn } from "@/lib/utils";

const COMPARISON_ENDPOINT = "/api/comparison";

type Props = {
  items: SelectableAd[];
  isLoading?: boolean;
  className?: string;
};

export default function FavoritesComparisonView({ items, isLoading = false, className }: Props) {
  const { t } = useI18n();
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [comparisonAdverts, setComparisonAdverts] = useState<ComparableAdvert[]>([]);

  const handleCompare = useCallback(async (selectedIds: string[]) => {
    setComparisonError(null);
    setComparisonLoading(true);
    try {
      const response = await fetch(COMPARISON_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ advertIds: selectedIds }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !payload?.data?.adverts) {
        const errorCode: string | undefined = payload?.error;
        const detail: string | undefined = payload?.detail;
        let message = t("comparison.error_generic");

        if (errorCode) {
          const codeKey = `comparison.error_code.${errorCode}`;
          const translated = t(codeKey);
          if (translated !== codeKey) {
            message = translated;
          }
        }

        if (detail && (!errorCode || message === t("comparison.error_generic"))) {
          message = detail;
        }

        throw new Error(message ?? t("comparison.error_generic"));
      }

      setComparisonAdverts(payload.data.adverts as ComparableAdvert[]);
      setComparisonOpen(true);
    } catch (error) {
      console.error("Comparison fetch failed", error);
      const fallback = t("comparison.error_generic") || "comparison_failed";
      const message = error instanceof Error ? error.message : fallback;
      setComparisonError(message || fallback);
    } finally {
      setComparisonLoading(false);
    }
  }, [t]);

  return (
    <section className={cn("space-y-4", className)}>
      {comparisonError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {comparisonError}
        </div>
      ) : null}

      <SelectableAdsGrid
        items={items}
        maxSelection={4}
        onCompare={handleCompare}
        isLoading={comparisonLoading || isLoading}
      />

      <ComparisonTable
        open={comparisonOpen}
        onOpenChange={setComparisonOpen}
        adverts={comparisonAdverts}
      />
    </section>
  );
}
