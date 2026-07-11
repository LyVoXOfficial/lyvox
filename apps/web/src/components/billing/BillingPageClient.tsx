"use client";

import Link from "next/link";
import {
  BadgeEuro,
  CalendarDays,
  CheckCircle,
  Clock,
  CreditCard,
  PackageCheck,
  Plus,
  Receipt,
  RefreshCw,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import BenefitsBadge from "@/components/BenefitsBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n";
import { formatCurrency } from "@/i18n/format";
import { formatDate } from "@/lib/i18n/formatDate";

interface Purchase {
  id: string;
  product_code: string;
  provider: string;
  status: string;
  amount_cents: number;
  currency: string | null;
  created_at: string | null;
  updated_at: string | null;
  products?: {
    code: string;
    name: unknown;
  } | null;
}

interface Benefit {
  id: string;
  purchase_id: string | null;
  advert_id: string | null;
  benefit_type: string;
  valid_from: string | null;
  valid_until: string;
  created_at: string | null;
}

interface BillingPageClientProps {
  purchases: Purchase[];
  benefits: Benefit[];
  messages: Record<string, any>;
  paidBoostsEnabled: boolean;
}

const statusFallbacks: Record<string, string> = {
  completed: "Paid",
  failed: "Failed",
  pending: "Pending",
  refunded: "Refunded",
};

const benefitFallbacks: Record<string, string> = {
  top: "Top placement",
  featured: "Featured listing",
  highlight: "Highlighted listing",
  urgent: "Urgent badge",
  boost: "Listing boost",
};

export default function BillingPageClient({
  purchases,
  benefits,
  paidBoostsEnabled,
}: BillingPageClientProps) {
  const { t, locale } = useI18n();

  const translate = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-emerald-600" aria-hidden="true" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />;
      case "pending":
        return <Clock className="h-4 w-4 text-amber-600" aria-hidden="true" />;
      case "refunded":
        return <RefreshCw className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
      default:
        return <Receipt className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
      completed: "default",
      failed: "destructive",
      pending: "secondary",
      refunded: "outline",
    };
    const label = translate(
      `billing.status.${status}`,
      statusFallbacks[status] ?? humanizeCode(status),
    );

    return (
      <Badge variant={variants[status] || "secondary"}>
        {getStatusIcon(status)}
        <span>{label}</span>
      </Badge>
    );
  };

  const getProductName = (purchase: Purchase) => {
    if (
      purchase.products?.name &&
      typeof purchase.products.name === "object" &&
      !Array.isArray(purchase.products.name)
    ) {
      const name = purchase.products.name as Record<string, unknown>;
      const localized = name[locale] ?? name.en;
      if (typeof localized === "string" && localized.trim()) {
        return localized;
      }
    }
    return humanizeCode(purchase.product_code);
  };

  const getBenefitName = (benefitType: string) => {
    return translate(
      `billing.benefits.${benefitType}`,
      benefitFallbacks[benefitType] ?? humanizeCode(benefitType),
    );
  };

  const totalSpent = purchases.reduce((sum, purchase) => {
    if (purchase.status !== "completed") {
      return sum;
    }
    return sum + purchase.amount_cents;
  }, 0);
  const currency = purchases.find((purchase) => purchase.currency)?.currency ?? "EUR";

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge variant="secondary" className="mb-3">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {translate("billing.trust_badge", "Secure promotion history")}
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight">
            {translate("billing.title", "Billing and benefits")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {translate(
              "billing.subtitle",
              "Track payments, active listing benefits, and promotion history for your LyVoX account.",
            )}
          </p>
        </div>
        {paidBoostsEnabled && (
          <Button asChild>
            <Link href="/profile/adverts">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {translate("billing.boost_listing", "Boost a listing")}
            </Link>
          </Button>
        )}
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <MetricCard
          icon={Receipt}
          label={translate("billing.metrics.purchases", "Purchases")}
          value={String(purchases.length)}
        />
        <MetricCard
          icon={PackageCheck}
          label={translate("billing.metrics.active_benefits", "Active benefits")}
          value={String(benefits.length)}
        />
        <MetricCard
          icon={BadgeEuro}
          label={translate("billing.metrics.paid_total", "Paid total")}
          value={formatCurrency(totalSpent / 100, locale, currency)}
        />
      </div>

      <Tabs defaultValue="purchases" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="purchases">
            {translate("billing.tabs.purchases", "Purchases")}
          </TabsTrigger>
          <TabsTrigger value="benefits">
            {translate("billing.tabs.benefits", "Active benefits")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="purchases" className="space-y-3">
          {purchases.length === 0 ? (
            <EmptyBillingState
              icon={CreditCard}
              title={translate("billing.no_purchases_title", "No payments yet")}
              body={translate(
                "billing.no_purchases",
                "When you promote a listing, payment status and receipts will appear here.",
              )}
              actionLabel={translate("billing.empty.manage_adverts", "Manage adverts")}
              actionHref="/profile/adverts"
            />
          ) : (
            purchases.map((purchase) => (
              <Card key={purchase.id} className="rounded-md py-0">
                <CardHeader className="gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-lg">{getProductName(purchase)}</CardTitle>
                    <CardDescription className="mt-1">
                      {translate("billing.purchase_id", "Purchase")}{" "}
                      <span className="font-mono">{purchase.id.slice(0, 8)}</span>
                    </CardDescription>
                  </div>
                  {getStatusBadge(purchase.status)}
                </CardHeader>
                <CardContent className="grid gap-3 p-4 pt-0 text-sm sm:grid-cols-3">
                  <BillingFact
                    label={translate("billing.amount", "Amount")}
                    value={formatCurrency(
                      purchase.amount_cents / 100,
                      locale,
                      purchase.currency ?? "EUR",
                    )}
                  />
                  <BillingFact
                    label={translate("billing.date", "Date")}
                    value={
                      purchase.created_at
                        ? formatDate(purchase.created_at, locale, "short")
                        : translate("billing.not_available", "Not available")
                    }
                  />
                  <BillingFact
                    label={translate("billing.provider", "Provider")}
                    value={purchase.provider.toUpperCase()}
                  />
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="benefits" className="space-y-3">
          {benefits.length === 0 ? (
            <EmptyBillingState
              icon={PackageCheck}
              title={translate("billing.no_benefits_title", "No active benefits")}
              body={translate(
                "billing.no_benefits",
                "Promoted listings, highlights, and top placements will appear here while they are active.",
              )}
              actionLabel={translate("billing.empty.choose_listing", "Choose a listing")}
              actionHref="/profile/adverts"
            />
          ) : (
            benefits.map((benefit) => (
              <Card key={benefit.id} className="rounded-md py-0">
                <CardHeader className="gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-lg">{getBenefitName(benefit.benefit_type)}</CardTitle>
                    <CardDescription className="mt-1">
                      {translate("billing.active_until", "Active until")}{" "}
                      {formatDate(benefit.valid_until, locale, "short")}
                    </CardDescription>
                  </div>
                  <BenefitsBadge benefits={[benefit]} />
                </CardHeader>
                <CardContent className="grid gap-3 p-4 pt-0 text-sm sm:grid-cols-3">
                  <BillingFact
                    icon={CalendarDays}
                    label={translate("billing.valid_until", "Valid until")}
                    value={formatDate(benefit.valid_until, locale, "short")}
                  />
                  <BillingFact
                    label={translate("billing.advert", "Advert")}
                    value={
                      benefit.advert_id
                        ? benefit.advert_id.slice(0, 8)
                        : translate("billing.not_linked", "Not linked")
                    }
                    mono={Boolean(benefit.advert_id)}
                  />
                  <BillingFact
                    label={translate("billing.purchase", "Purchase")}
                    value={
                      benefit.purchase_id
                        ? benefit.purchase_id.slice(0, 8)
                        : translate("billing.not_available", "Not available")
                    }
                    mono={Boolean(benefit.purchase_id)}
                  />
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <Card className="rounded-md py-0">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyBillingState({
  icon: Icon,
  title,
  body,
  actionLabel,
  actionHref,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <Card className="rounded-md py-0">
      <CardContent className="flex flex-col items-center p-8 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{body}</p>
        <Button asChild className="mt-5">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function BillingFact({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-muted/30 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
        {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
        {label}
      </p>
      <p className={`mt-1 font-semibold ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function humanizeCode(value: string) {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
