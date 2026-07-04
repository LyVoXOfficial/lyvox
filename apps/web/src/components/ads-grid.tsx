"use client";

import AdCard from "@/components/ad-card";
import { MarketplaceEmptyState } from "@/components/marketplace-grid-states";

type Item = {
  id: string;
  categoryId?: string | null;
  title: string;
  price?: number | null;
  currency?: string | null;
  location?: string | null;
  image?: string | null;
  createdAt?: string | null;
  sellerVerified?: boolean;
  likeCount?: number;
};

type AdsGridProps = {
  items: Item[];
  emptyTitle?: string;
  emptyDescription?: string;
  primaryAction?: {
    href: string;
    label: string;
    variant?: "default" | "outline" | "secondary" | "ghost";
  };
  secondaryAction?: {
    href: string;
    label: string;
    variant?: "default" | "outline" | "secondary" | "ghost";
  };
  /**
   * Optional Tailwind grid-cols classes to override the default 2→3→4 layout.
   * Pass e.g. "grid-cols-2 sm:grid-cols-3" for the search page (3-col desktop in
   * the rail+results layout where the rail already takes ~262px).
   */
  gridColsClass?: string;
};

export default function AdsGrid({
  items,
  emptyTitle,
  emptyDescription,
  primaryAction,
  secondaryAction,
  gridColsClass = "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
}: AdsGridProps) {
  if (!items?.length) {
    return (
      <MarketplaceEmptyState
        title={emptyTitle}
        description={emptyDescription}
        primaryAction={primaryAction}
        secondaryAction={secondaryAction}
      />
    );
  }

  return (
    <div className={`grid gap-3 lg:gap-4 ${gridColsClass}`}>
      {items.map((item) => (
        <AdCard key={item.id} {...item} />
      ))}
    </div>
  );
}
