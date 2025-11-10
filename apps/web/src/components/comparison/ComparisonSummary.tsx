"use client";

import { useMemo } from "react";
import { useI18n } from "@/i18n";
import { formatCurrency } from "@/i18n/format";
import { formatRelativeTime } from "@/lib/i18n/formatDate";
import type { ComparisonResult } from "@/lib/types/comparison";

type Props = {
  results: ComparisonResult[];
};

function pickBest(
  results: ComparisonResult[],
  selector: (result: ComparisonResult) => number,
): ComparisonResult | null {
  return results.reduce<ComparisonResult | null>((best, current) => {
    if (!best) return current;
    return selector(current) > selector(best) ? current : best;
  }, null);
}

export default function ComparisonSummary({ results }: Props) {
  const { t, locale } = useI18n();

  const summary = useMemo(() => {
    if (!results.length) {
      return [];
    }

    const bestOverall = pickBest(results, (result) => result.scores.totalScore);
    const bestPrice = pickBest(results, (result) => result.scores.priceScore);
    const mostTrusted = pickBest(results, (result) => result.scores.trustScore);
    const newest = pickBest(results, (result) => result.scores.ageScore);

    const items: Array<{ id: string; text: string }> = [];

    if (bestOverall) {
      items.push({
        id: "overall",
        text: t("comparison.summary_best_overall", { advert: bestOverall.advert.title }),
      });
    }

    if (bestPrice) {
      const hasPrice = typeof bestPrice.advert.price === "number" && !Number.isNaN(bestPrice.advert.price);
      const priceString = hasPrice
        ? formatCurrency(bestPrice.advert.price as number, locale, bestPrice.advert.currency ?? "EUR")
        : t("comparison.price_unknown");

      items.push({
        id: "price",
        text: t("comparison.summary_best_price", {
          advert: bestPrice.advert.title,
          price: priceString,
        }),
      });
    }

    if (mostTrusted) {
      const trustLabel = t("comparison.summary_most_trusted", {
        advert: mostTrusted.advert.title,
        score: Math.round(mostTrusted.advert.sellerTrustScore).toString(),
        status: mostTrusted.advert.sellerVerified
          ? t("comparison.seller_verified")
          : t("comparison.seller_unverified"),
      });
      items.push({ id: "trust", text: trustLabel });
    }

    if (newest) {
      const relativeTime = newest.advert.createdAt
        ? formatRelativeTime(newest.advert.createdAt, locale)
        : t("comparison.date_unknown");

      items.push({
        id: "freshness",
        text: t("comparison.summary_newest", {
          advert: newest.advert.title,
          time: relativeTime,
        }),
      });
    }

    return items;
  }, [locale, results, t]);

  if (!summary.length) {
    return null;
  }

  return (
    <section className="rounded-lg border bg-muted/20 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
        {t("comparison.summary_title")}
      </h3>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {summary.map((item) => (
          <li key={item.id} className="flex items-start gap-2">
            <span className="mt-1 inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-primary/70" aria-hidden="true" />
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
