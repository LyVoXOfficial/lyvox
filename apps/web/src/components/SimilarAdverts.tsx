import AdsGrid from "@/components/ads-grid";

type SimilarAdvert = {
  id: string;
  title: string;
  price: number | null;
  currency: string | null;
  location: string | null;
  createdAt: string | null;
  image: string | null;
  sellerVerified?: boolean;
};

type SimilarAdvertsProps = {
  title: string;
  adverts: SimilarAdvert[];
  emptyMessage?: string;
};

export default function SimilarAdverts({ title, adverts, emptyMessage }: SimilarAdvertsProps) {
  if (!adverts?.length) {
    return emptyMessage ? (
      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="text-lg font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </section>
    ) : null;
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="text-lg font-medium">{title}</h2>
      <AdsGrid items={adverts} />
    </section>
  );
}

