"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n";

type SortOption = {
  value: string;
  label: string;
};

export default function CategoryFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  const currentSort = searchParams.get("sort") || "date-desc";

  const sortOptions: SortOption[] = [
    { value: "date-desc", label: t("filters.newest_first") || "Newest first" },
    { value: "date-asc", label: t("filters.oldest_first") || "Oldest first" },
    { value: "price-asc", label: t("filters.price_low_high") || "Price: low to high" },
    { value: "price-desc", label: t("filters.price_high_low") || "Price: high to low" },
  ];

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-4 border-y border-border/80 bg-muted/30 py-3">
      <label htmlFor="sort" className="text-sm font-medium text-muted-foreground">
        {t("filters.sort_by") || "Sort by"}
      </label>
      <select
        id="sort"
        value={currentSort}
        onChange={(event) => handleSortChange(event.target.value)}
        className="h-10 max-w-xs flex-1 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {sortOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
