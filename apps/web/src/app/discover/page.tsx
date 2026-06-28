import { getI18nProps } from "@/i18n/server";
import SwipeDeck from "@/components/discover/SwipeDeck";
import { DROPS } from "@/lib/discover/deck";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const { messages } = await getI18nProps();
  const t = (key: string) =>
    key.split(".").reduce<any>((acc, p) => (acc ? acc[p] : undefined), messages) ?? key;

  return (
    <main className="container mx-auto max-w-3xl px-4 py-6">
      <header className="mb-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t("discover.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("discover.subtitle")}</p>
      </header>
      {/* Deck fetches its first page client-side (reuses /api/search). */}
      {/* Coach-mark + settings are managed inside SwipeDeck. */}
      <SwipeDeck initial={[]} drops={DROPS} />
    </main>
  );
}
