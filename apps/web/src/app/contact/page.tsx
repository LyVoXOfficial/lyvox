"use client";

import Link from "next/link";
import { ArrowRight, Clock, LifeBuoy, Mail, MessageSquare, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

export default function ContactPage() {
  const { t } = useI18n();
  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const contactOptions = [
    {
      title: tr("contactpage.accountTitle", "Account and access"),
      description: tr(
        "contactpage.accountDesc",
        "Help with sign in, recovery, profile verification, or suspicious account activity.",
      ),
      href: "/auth/recovery",
      icon: ShieldCheck,
      action: tr("contactpage.accountAction", "Recover access"),
    },
    {
      title: tr("contactpage.listingTitle", "Listing or transaction issue"),
      description: tr(
        "contactpage.listingDesc",
        "Report a suspicious advert, payment concern, or safety issue before continuing a deal.",
      ),
      href: "/search",
      icon: MessageSquare,
      action: tr("contactpage.listingAction", "Find listing"),
    },
    {
      title: tr("contactpage.generalTitle", "General support"),
      description: tr(
        "contactpage.generalDesc",
        "Questions about LyVoX, marketplace policies, partnerships, or operational support.",
      ),
      href: "mailto:support@lyvox.be",
      icon: Mail,
      action: tr("contactpage.generalAction", "Email support"),
    },
  ];

  return (
    <main className="bg-background">
      <section className="border-b border-border/70">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[minmax(0,1fr)_360px] md:py-14">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-xl lyvox-trust-gradient px-3 py-1 text-xs font-medium text-white">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {tr("contactpage.badge", "Support center")}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
              {tr("contactpage.title", "Contact LyVoX support")}
            </h1>
            <p className="text-base leading-7 text-muted-foreground">
              {tr(
                "contactpage.lead",
                "Choose the route that matches your issue. For listing, payment, or safety reports, include the advert link, seller profile, screenshots, and the timeline of what happened.",
              )}
            </p>
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-start gap-3">
              <Clock className="mt-1 h-5 w-5 text-primary" aria-hidden="true" />
              <div>
                <p className="font-semibold text-foreground">
                  {tr("contactpage.priorityTitle", "Response priorities")}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {tr(
                    "contactpage.priorityBody",
                    "Safety, account access, and transaction issues are reviewed first. Routine product questions are handled after urgent trust and security reports.",
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 md:py-10">
        <div className="grid gap-4 md:grid-cols-3">
          {contactOptions.map((option) => {
            const Icon = option.icon;
            const isExternal = option.href.startsWith("mailto:");

            return (
              <div
                key={option.title}
                className="rounded-xl border border-border/70 bg-card p-5 shadow-[var(--shadow-soft)]"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-lg font-extrabold tracking-tight text-foreground">{option.title}</h2>
                <p className="mt-2 min-h-20 text-sm leading-6 text-muted-foreground">{option.description}</p>
                <Button asChild variant="outline" className="mt-5 w-full justify-between">
                  <Link href={option.href} target={isExternal ? "_blank" : undefined}>
                    {option.action}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-border/70 bg-muted p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg font-extrabold tracking-tight text-foreground">
            {tr("contactpage.beforeTitle", "Before you contact us")}
          </h2>
          <div className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
            <p>
              {tr(
                "contactpage.beforeTip1",
                "Do not share passwords, card details, or one-time codes in messages.",
              )}
            </p>
            <p>
              {tr(
                "contactpage.beforeTip2",
                "Use the report button on suspicious adverts so moderation receives the listing context.",
              )}
            </p>
            <p>
              {tr(
                "contactpage.beforeTip3",
                "Keep communication inside LyVoX chat whenever possible for a clearer dispute trail.",
              )}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
