import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Car,
  CheckCircle2,
  Home,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { getI18nProps } from "@/i18n/server";
import { localizeHref } from "@/lib/i18n";
import { getJsonLdScriptProps } from "@/lib/seo";
import { guides, type GuideIcon } from "@/lib/guides";
import { languageAlternates, localizedCanonical } from "@/lib/seo/localizedUrls";

export const revalidate = 3600;

type GuideSection = {
  heading: string;
  body: string;
};

type GuideCopy = {
  title?: string;
  intro?: string;
  sections?: GuideSection[];
  category_label?: string;
};

type GuidesMessages = {
  meta_title?: string;
  meta_description?: string;
  title?: string;
  subtitle?: string;
  read_guide?: string;
  trust_title?: string;
  trust_body?: string;
  items?: Record<string, GuideCopy>;
};

const iconMap: Record<GuideIcon, typeof ShieldCheck> = {
  car: Car,
  check: CheckCircle2,
  home: Home,
  "map-pin": MapPin,
  message: MessageCircle,
  phone: MessageCircle,
  shield: ShieldCheck,
  smartphone: Smartphone,
};

const guidesCopy = (messages: Record<string, unknown> | undefined) =>
  ((messages?.guides ?? {}) as GuidesMessages);

export async function generateMetadata(): Promise<Metadata> {
  const { locale, messages } = await getI18nProps();
  const g = guidesCopy(messages);
  const title = g.meta_title ?? "Anti-scam guides for Belgian classifieds | LyVoX";
  const description =
    g.meta_description ??
    "Practical checks for second-hand cars, electronics, housing, jobs and local handovers in Belgium.";

  return {
    title,
    description,
    alternates: {
      canonical: localizedCanonical("/guides", locale),
      languages: languageAlternates("/guides"),
    },
    openGraph: {
      title,
      description,
      url: localizedCanonical("/guides", locale),
      type: "website",
      siteName: "LyVoX",
    },
  };
}

export default async function GuidesPage() {
  const { locale, messages } = await getI18nProps();
  const g = guidesCopy(messages);
  const href = (path: string) => localizeHref(path, locale);

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: guides.map((guide, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: localizedCanonical(`/guides/${guide.slug}`, locale),
      name: g.items?.[guide.slug]?.title ?? guide.slug,
    })),
  };

  return (
    <>
      <script {...getJsonLdScriptProps(itemListJsonLd)} />
      <div className="mx-auto max-w-5xl space-y-10 py-8 md:py-12">
        <section className="max-w-3xl space-y-4">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">
            LyVoX guides
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">
            {g.title ?? "Anti-scam guides for Belgian classifieds"}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            {g.subtitle ??
              "Short, practical checks before you visit, inspect or agree on a local deal."}
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {guides.map((guide) => {
            const copy = g.items?.[guide.slug];
            const Icon = iconMap[guide.icon];
            return (
              <Link
                key={guide.slug}
                href={href(`/guides/${guide.slug}`)}
                className="group rounded-[var(--rm)] border border-border/70 bg-card p-5 shadow-[var(--shadow-soft)] transition hover:border-primary/40 hover:shadow-md"
              >
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent/40 text-accent-foreground">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="text-lg font-extrabold tracking-tight">
                  {copy?.title ?? guide.slug}
                </h2>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                  {copy?.intro ?? ""}
                </p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary">
                  {g.read_guide ?? "Read guide"}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </section>

        <section className="rounded-[var(--rm)] border border-border/70 bg-muted/35 p-5">
          <h2 className="text-lg font-extrabold tracking-tight">
            {g.trust_title ?? "Keep checks visible"}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {g.trust_body ??
              "Use verified seller signals, platform chat and reporting tools together with your own inspection."}
          </p>
        </section>
      </div>
    </>
  );
}
