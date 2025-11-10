"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ComparisonSummary from "@/components/comparison/ComparisonSummary";
import { compareAdverts } from "@/lib/comparison";
import type { ComparableAdvert } from "@/lib/types/comparison";
import { formatCurrency } from "@/i18n/format";
import { formatRelativeTime } from "@/lib/i18n/formatDate";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adverts: ComparableAdvert[];
};

type TableRow = {
  id: string;
  label: string;
  render: (result: ReturnType<typeof compareAdverts>[number]) => React.ReactNode;
  highlight?: (result: ReturnType<typeof compareAdverts>[number]) => boolean;
};

function formatSpecifics(advert: ComparableAdvert, fallback: string): React.ReactNode {
  const entries = Object.entries(advert.specifics ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 4);

  if (!entries.length) {
    return <span className="text-muted-foreground">{fallback}</span>;
  }

  return (
    <ul className="space-y-1 text-sm text-muted-foreground">
      {entries.map(([key, value]) => {
        const title = key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase());
        return (
          <li key={key} className="flex items-start gap-2">
            <span className="mt-1 inline-flex h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
            <span>
              <span className="font-medium text-foreground">{title}:</span> {String(value)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function ComparisonTable({ open, onOpenChange, adverts }: Props) {
  const { t, locale } = useI18n();

  const results = useMemo(() => compareAdverts(adverts), [adverts]);

  if (!results.length) {
    return null;
  }

  const maxTotal = Math.max(...results.map((result) => result.scores.totalScore));
  const maxPrice = Math.max(...results.map((result) => result.scores.priceScore));
  const maxTrust = Math.max(...results.map((result) => result.scores.trustScore));
  const maxFreshness = Math.max(...results.map((result) => result.scores.ageScore));

  const bestOverallIds = new Set(
    results.filter((result) => result.scores.totalScore === maxTotal).map((result) => result.advert.id),
  );
  const bestPriceIds = new Set(
    results.filter((result) => result.scores.priceScore === maxPrice).map((result) => result.advert.id),
  );
  const bestTrustIds = new Set(
    results.filter((result) => result.scores.trustScore === maxTrust).map((result) => result.advert.id),
  );
  const bestFreshnessIds = new Set(
    results.filter((result) => result.scores.ageScore === maxFreshness).map((result) => result.advert.id),
  );

  const resolveConditionLabel = (condition: string | null): string => {
    if (!condition) {
      return t("comparison.condition_unknown");
    }

    const key = `comparison.condition.${condition}`;
    const translated = t(key);
    return translated === key ? condition : translated;
  };

  const rows: TableRow[] = [
    {
      id: "price",
      label: t("comparison.table_price"),
      render: (result) => {
        const { advert } = result;
        if (advert.price === null || Number.isNaN(advert.price)) {
          return <span className="text-muted-foreground">{t("comparison.price_unknown")}</span>;
        }
        return formatCurrency(advert.price, locale, advert.currency ?? "EUR");
      },
      highlight: (result) => bestPriceIds.has(result.advert.id),
    },
    {
      id: "category",
      label: t("comparison.table_category"),
      render: (result) => result.advert.categoryName ?? t("comparison.category_unknown"),
    },
    {
      id: "location",
      label: t("comparison.table_location"),
      render: (result) => result.advert.location ?? t("comparison.location_unknown"),
    },
    {
      id: "condition",
      label: t("comparison.table_condition"),
      render: (result) => resolveConditionLabel(result.advert.condition),
    },
    {
      id: "trust",
      label: t("comparison.table_trust"),
      render: (result) => (
        <div className="space-y-1">
          <div className="text-sm font-semibold text-foreground">
            {Math.round(result.advert.sellerTrustScore)} / 100
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-emerald-500"
              style={{ width: `${Math.min(100, Math.max(0, result.advert.sellerTrustScore))}%` }}
            />
          </div>
        </div>
      ),
      highlight: (result) => bestTrustIds.has(result.advert.id),
    },
    {
      id: "verification",
      label: t("comparison.table_verification"),
      render: (result) => (
        <Badge variant={result.advert.sellerVerified ? "default" : "secondary"} className="gap-1">
          {result.advert.sellerVerified ? (
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {result.advert.sellerVerified
            ? t("comparison.seller_verified")
            : t("comparison.seller_unverified")}
        </Badge>
      ),
    },
    {
      id: "posted",
      label: t("comparison.table_posted"),
      render: (result) =>
        result.advert.createdAt
          ? formatRelativeTime(result.advert.createdAt, locale)
          : t("comparison.date_unknown"),
      highlight: (result) => bestFreshnessIds.has(result.advert.id),
    },
    {
      id: "specifics",
      label: t("comparison.table_specifics"),
      render: (result) => formatSpecifics(result.advert, t("comparison.specifics_unknown")),
    },
    {
      id: "score",
      label: t("comparison.table_score"),
      render: (result) => (
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {Math.round(result.scores.totalScore)} / 100
          {bestOverallIds.has(result.advert.id) ? (
            <Badge variant="secondary">{t("comparison.badge_best_overall")}</Badge>
          ) : null}
        </div>
      ),
      highlight: (result) => bestOverallIds.has(result.advert.id),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t("comparison.title")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-6">
          <div className="overflow-x-auto">
            <table className="min-w-[720px] table-fixed border-separate border-spacing-y-3">
              <thead>
                <tr>
                  <th className="w-40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("comparison.table_attribute")}
                  </th>
                  {results.map((result) => (
                    <th key={result.advert.id} className="align-top">
                      <div className="space-y-3 rounded-lg border bg-muted/30 p-3 text-left">
                        <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
                          {result.advert.image ? (
                            <Image
                              src={result.advert.image}
                              alt={result.advert.title}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                              {t("comparison.photo_missing")}
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Link
                            href={`/ad/${result.advert.id}`}
                            className="line-clamp-2 text-sm font-semibold text-foreground hover:underline"
                          >
                            {result.advert.title}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {result.advert.categoryName ?? t("comparison.category_unknown")}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{t("comparison.total_score_label")}</span>
                          <span className="font-semibold text-foreground">
                            {Math.round(result.scores.totalScore)}
                          </span>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="pr-4 align-top text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {row.label}
                    </td>
                    {results.map((result) => {
                      const content = row.render(result);
                      const isHighlight = row.highlight?.(result) ?? false;
                      return (
                        <td key={`${row.id}-${result.advert.id}`} className="align-top">
                          <div
                            className={cn(
                              "min-h-[56px] rounded-md border bg-background p-3 text-sm",
                              isHighlight && "border-primary/50 shadow-sm",
                            )}
                          >
                            {content}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ComparisonSummary results={results} />

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("comparison.close")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
