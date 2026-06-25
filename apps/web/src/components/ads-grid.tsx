"use client";

import AdCard from "@/components/ad-card";
import { MarketplaceEmptyState } from "@/components/marketplace-grid-states";

type Item = {
  id: string;
  title: string;
  price?: number | null;
  currency?: string | null;
  location?: string | null;
  image?: string | null;
  createdAt?: string | null;
  sellerVerified?: boolean;
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
};

export default function AdsGrid({
  items,
  emptyTitle,
  emptyDescription,
  primaryAction,
  secondaryAction,
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:gap-4">
      {items.map((item) => (
        <AdCard key={item.id} {...item} />
      ))}
    </div>
  );
}
