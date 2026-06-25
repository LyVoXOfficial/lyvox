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
  const tr = (k: string, fb: string) => {
    const v = t(k);
    return v === k ? fb : v;
  };

  const currentSort = searchParams.get("sort") || "date-desc";

  const sortOptions: SortOption[] = [
    { value: "date-desc", label: tr("filters.newest_first", "Newest first") },
    { value: "date-asc", label: tr("filters.oldest_first", "Oldest first") },
    { value: "price-asc", label: tr("filters.price_low_high", "Price: low to high") },
    { value: "price-desc", label: tr("filters.price_high_low", "Price: high to low") },
  ];

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 shadow-[var(--shadow-soft)]">
      <label htmlFor="sort" className="text-sm font-medium text-muted-foreground">
        {tr("filters.sort_by", "Sort by")}
      </label>
      <select
        id="sort"
        value={currentSort}
        onChange={(event) => handleSortChange(event.target.value)}
        className="h-10 max-w-xs flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground transition focus:outline-none focus:ring-4 focus:ring-primary/12"
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
