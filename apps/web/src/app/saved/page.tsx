import { getI18nProps } from "@/i18n/server";
import SavedSearchesClient from "@/components/saved/SavedSearchesClient";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const { messages } = await getI18nProps();
  const t = (key: string) =>
    key.split(".").reduce<any>((acc, p) => (acc ? acc[p] : undefined), messages) ?? key;

  return (
    <main className="container mx-auto max-w-2xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("saved.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("saved.subtitle")}</p>
      </header>
      <SavedSearchesClient />
    </main>
  );
}
