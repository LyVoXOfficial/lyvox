import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Flag, MessageCircle, ShieldCheck } from "lucide-react";
import { getI18nProps } from "@/i18n/server";
import { localizeHref } from "@/lib/i18n";
import { findGuide, guides } from "@/lib/guides";
import { getJsonLdScriptProps } from "@/lib/seo";
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
  back_to_guides?: string;
  category_cta?: string;
  trust_title?: string;
  trust_body?: string;
  trust_verified?: string;
  trust_chat?: string;
  trust_report?: string;
  items?: Record<string, GuideCopy>;
};

type Props = {
  params: Promise<{ slug: string }>;
};

const guidesCopy = (messages: Record<string, unknown> | undefined) =>
  ((messages?.guides ?? {}) as GuidesMessages);

export function generateStaticParams() {
  return guides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = findGuide(slug);
  if (!guide) return {};

  const { locale, messages } = await getI18nProps();
  const copy = guidesCopy(messages).items?.[guide.slug];
  const title = copy?.title ? `${copy.title} | LyVoX` : "Guide | LyVoX";
  const description = copy?.intro ?? "";

  return {
    title,
    description,
    alternates: {
      canonical: localizedCanonical(`/guides/${guide.slug}`, locale),
      languages: languageAlternates(`/guides/${guide.slug}`),
    },
    openGraph: {
      title,
      description,
      url: localizedCanonical(`/guides/${guide.slug}`, locale),
      type: "article",
      siteName: "LyVoX",
    },
  };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = findGuide(slug);
  if (!guide) notFound();

  const { locale, messages } = await getI18nProps();
  const g = guidesCopy(messages);
  const copy = g.items?.[guide.slug];
  if (!copy) notFound();

  const href = (path: string) => localizeHref(path, locale);
  const sections = copy.sections ?? [];
  const canonical = localizedCanonical(`/guides/${guide.slug}`, locale);
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: copy.title,
    description: copy.intro,
    mainEntityOfPage: canonical,
    publisher: {
      "@type": "Organization",
      name: "LyVoX",
    },
  };

  const trustItems = [
    { icon: CheckCircle2, label: g.trust_verified ?? "Check verified seller signals" },
    { icon: MessageCircle, label: g.trust_chat ?? "Keep the conversation in LyVoX chat" },
    { icon: Flag, label: g.trust_report ?? "Report suspicious listings or messages" },
  ];

  return (
    <>
      <script {...getJsonLdScriptProps(articleJsonLd)} />
      <article className="mx-auto max-w-3xl space-y-8 py-8 md:py-12">
        <Link
          href={href("/guides")}
          className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {g.back_to_guides ?? "All guides"}
        </Link>

        <header className="space-y-4">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">
            LyVoX guides
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">
            {copy.title}
          </h1>
          <p className="text-base leading-7 text-muted-foreground">{copy.intro}</p>
        </header>

        <div className="space-y-5">
          {sections.map((section, index) => (
            <section
              key={section.heading}
              className="rounded-[var(--rm)] border border-border/70 bg-card p-5 shadow-[var(--shadow-soft)]"
            >
              <h2 className="text-lg font-extrabold tracking-tight">
                {index + 1}. {section.heading}
              </h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>

        <section className="rounded-[var(--rm)] border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">
                {g.trust_title ?? "Use LyVoX trust signals"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {g.trust_body ??
                  "Combine platform signals with your own inspection before arranging a local handover."}
              </p>
              <ul className="mt-4 grid gap-2 text-sm text-muted-foreground">
                {trustItems.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <Link
          href={href(guide.categoryLink)}
          className="lyvox-cta-gradient inline-flex h-12 items-center gap-2 rounded-[var(--rm)] px-6 text-sm font-bold text-primary-foreground transition hover:brightness-105 active:scale-[0.98]"
        >
          {copy.category_label ?? g.category_cta ?? "Browse related listings"}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </article>
    </>
  );
}
