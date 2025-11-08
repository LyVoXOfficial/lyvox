"use client";

import AdCard from "@/components/ad-card";

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

export default function AdsGrid({ items }: { items: Item[] }) {
  if (!items?.length) {
    return <p className="text-sm text-muted-foreground">Объявления не найдены.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {items.map((item) => (
        <AdCard key={item.id} {...item} />
      ))}
    </div>
  );
}
