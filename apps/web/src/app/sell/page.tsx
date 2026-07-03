import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Camera, ClipboardList, MessageSquare } from "lucide-react";
import { getI18nProps } from "@/i18n/server";
import { getJsonLdScriptProps } from "@/lib/seo";
import { absoluteUrl } from "@/lib/seo/baseUrl";

// Indexable seller landing (supply wave): the guest-facing pitch for the
// high-intent "post a free ad" queries. The actual /post flow stays behind
// auth and noindex; guests land here first.
export const revalidate = 3600;

type SellMessages = Record<string, string>;

const sellCopy = (messages: Record<string, unknown> | undefined) =>
  ((messages?.sell ?? {}) as SellMessages);

export async function generateMetadata(): Promise<Metadata> {
  const { messages } = await getI18nProps();
  const s = sellCopy(messages);
  return {
    title: s.meta_title ?? "Post a free classified ad in Belgium | LyVoX",
    description: s.meta_description ?? "Post a free listing in minutes and chat with buyers inside LyVoX.",
    alternates: { canonical: absoluteUrl("/sell") },
  };
}

export default async function SellPage() {
  const { messages } = await getI18nProps();
  const s = sellCopy(messages);
  const home = (messages?.home ?? {}) as SellMessages;

  const steps = [
    { icon: Camera, title: s.step1_title ?? "Add photos", body: s.step1_body ?? "" },
    { icon: ClipboardList, title: s.step2_title ?? "Describe it", body: s.step2_body ?? "" },
    { icon: MessageSquare, title: s.step3_title ?? "Reply in chat", body: s.step3_body ?? "" },
  ];

  const faq = [
    { q: s.faq_q1, a: s.faq_a1 },
    { q: s.faq_q2, a: s.faq_a2 },
    { q: s.faq_q3, a: s.faq_a3 },
  ].filter((item) => item.q && item.a);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  const popular = [
    { href: "/c/transport", label: home.qa_transport ?? "Transport" },
    { href: "/c/elektronika-i-tehnika", label: home.qa_electronics ?? "Electronics" },
    { href: "/c/dlya-doma-hobbi-i-detey", label: home.category_home ?? "Home & garden" },
  ];

  return (
    <>
      {faq.length > 0 ? <script {...getJsonLdScriptProps(faqJsonLd)} /> : null}
      <div className="mx-auto max-w-3xl space-y-10 py-8 md:py-12">
        {/* Hero */}
        <section className="space-y-4 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            {s.title ?? "Sell your stuff locally — free"}
          </h1>
          <p className="mx-auto max-w-xl text-muted-foreground">
            {s.subtitle ?? ""}
          </p>
          <Link
            href="/post"
            className="lyvox-cta-gradient inline-flex h-12 items-center gap-2 rounded-[var(--rm)] px-7 text-[15px] font-bold text-primary-foreground transition hover:brightness-105 active:scale-[0.98]"
          >
            {s.cta ?? "Post a listing"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>

        {/* 3 steps */}
        <section className="grid gap-4 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="rounded-[var(--rm)] border border-border/70 bg-card p-5 shadow-[var(--shadow-soft)]">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent/40 text-accent-foreground">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="text-[15px] font-bold tracking-tight">
                {i + 1}. {title}
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>

        {/* Popular categories */}
        <section className="space-y-3">
          <h2 className="text-lg font-extrabold tracking-tight">{s.popular ?? "Popular categories"}</h2>
          <div className="flex flex-wrap gap-2">
            {popular.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="inline-flex h-[38px] items-center rounded-full border border-border bg-card px-4 text-[13.5px] font-semibold transition hover:border-primary/40 hover:text-primary"
              >
                {label}
              </Link>
            ))}
          </div>
        </section>

        {/* FAQ — native details, fully in server HTML */}
        {faq.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold tracking-tight">{s.faq_title ?? "FAQ"}</h2>
            <div className="space-y-2">
              {faq.map((item) => (
                <details key={item.q} className="group rounded-[var(--rm)] border border-border/70 bg-card px-4 py-3">
                  <summary className="cursor-pointer list-none text-[14.5px] font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
                    {item.q}
                  </summary>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
