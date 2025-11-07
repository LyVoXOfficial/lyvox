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
    { value: "date-desc", label: t("filters.newest_first") || "Сначала новые" },
    { value: "date-asc", label: t("filters.oldest_first") || "Сначала старые" },
    { value: "price-asc", label: t("filters.price_low_high") || "Цена: от низкой к высокой" },
    { value: "price-desc", label: t("filters.price_high_low") || "Цена: от высокой к низкой" },
  ];
  
  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    router.push(`?${params.toString()}`);
  };
  
  return (
    <div className="flex items-center gap-4 py-3 border-y bg-muted/30">
      <label htmlFor="sort" className="text-sm font-medium text-muted-foreground">
        {t("filters.sort_by") || "Сортировать:"}
      </label>
      <select
        id="sort"
        value={currentSort}
        onChange={(e) => handleSortChange(e.target.value)}
        className="flex-1 max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

