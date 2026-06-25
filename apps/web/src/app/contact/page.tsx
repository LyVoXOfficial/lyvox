import Link from "next/link";
import { ArrowRight, Clock, LifeBuoy, Mail, MessageSquare, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const contactOptions = [
  {
    title: "Account and access",
    description: "Help with sign in, recovery, profile verification, or suspicious account activity.",
    href: "/auth/recovery",
    icon: ShieldCheck,
    action: "Recover access",
  },
  {
    title: "Listing or transaction issue",
    description: "Report a suspicious advert, payment concern, or safety issue before continuing a deal.",
    href: "/search",
    icon: MessageSquare,
    action: "Find listing",
  },
  {
    title: "General support",
    description: "Questions about LyVoX, marketplace policies, partnerships, or operational support.",
    href: "mailto:support@lyvox.be",
    icon: Mail,
    action: "Email support",
  },
];

export default function ContactPage() {
  return (
    <main className="bg-background">
      <section className="border-b border-border/80">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[minmax(0,1fr)_360px] md:py-14">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
              Support center
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Contact LyVoX support
            </h1>
            <p className="text-base leading-7 text-muted-foreground">
              Choose the route that matches your issue. For listing, payment, or safety reports,
              include the advert link, seller profile, screenshots, and the timeline of what happened.
            </p>
          </div>

          <div className="rounded-md border border-border/80 bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <Clock className="mt-1 h-5 w-5 text-primary" aria-hidden="true" />
              <div>
                <p className="font-semibold">Response priorities</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Safety, account access, and transaction issues are reviewed first. Routine product
                  questions are handled after urgent trust and security reports.
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
              <div key={option.title} className="rounded-md border border-border/80 bg-card p-5 shadow-sm">
                <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">{option.title}</h2>
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

        <div className="mt-8 rounded-md border border-border/80 bg-muted/35 p-5">
          <h2 className="text-lg font-semibold">Before you contact us</h2>
          <div className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
            <p>Do not share passwords, card details, or one-time codes in messages.</p>
            <p>Use the report button on suspicious adverts so moderation receives the listing context.</p>
            <p>Keep communication inside LyVoX chat whenever possible for a clearer dispute trail.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
