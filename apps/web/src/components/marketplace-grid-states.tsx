import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Plus, Search, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyAction = {
  href: string;
  label: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
};

type MarketplaceEmptyStateProps = {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  primaryAction?: EmptyAction;
  secondaryAction?: EmptyAction;
  /**
   * Custom action slot rendered below the description. Use for actions that
   * are not plain links — e.g. a SaveSearchButton on the /search zero-result
   * state. Rendered in addition to primary/secondary link actions.
   */
  children?: ReactNode;
  className?: string;
};

/**
 * Single empty-state rule for the whole marketplace: badge + title + hint +
 * an action. An empty state never reads as a dead end ("nothing here") — it
 * always offers a way forward (broaden, save, browse, post).
 *
 * Note: this is for *empty* content, not *errors*. A system failure
 * ("categories unavailable") should offer a retry, not a create-CTA.
 */
export function MarketplaceEmptyState({
  title = "No listings found",
  description = "Try a broader search, clear one of the filters, or create the first listing for this market.",
  icon: Icon = Search,
  primaryAction,
  secondaryAction,
  children,
  className,
}: MarketplaceEmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-dashed border-border bg-card p-8 text-center shadow-sm",
        className,
      )}
    >
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {children ? <div className="mt-5 flex flex-col items-center gap-3">{children}</div> : null}
      {(primaryAction || secondaryAction) ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {primaryAction ? <EmptyActionButton action={primaryAction} fallbackIcon={SlidersHorizontal} /> : null}
          {secondaryAction ? <EmptyActionButton action={secondaryAction} fallbackIcon={Plus} /> : null}
        </div>
      ) : null}
    </div>
  );
}

// Spec T14 names the unified component `EmptyState`; a marketplace-wide empty
// component already existed under this name, so alias it rather than duplicate.
export { MarketplaceEmptyState as EmptyState };

function EmptyActionButton({
  action,
  fallbackIcon: Icon,
}: {
  action: EmptyAction;
  fallbackIcon: LucideIcon;
}) {
  return (
    <Button asChild variant={action.variant ?? "default"}>
      <Link href={action.href}>
        <Icon className="h-4 w-4" aria-hidden="true" />
        {action.label}
      </Link>
    </Button>
  );
}

/**
 * Skeleton grid used in place of a spinner while results load. Each skeleton
 * card mirrors the real <AdCard> geometry (4:3 image, 14px body padding, price
 * row, 2-line title, location row, footer divider) so swapping skeleton → real
 * cards produces zero layout shift (CLS=0). `gridColsClass` must match the
 * caller's <AdsGrid gridColsClass> so column counts line up too.
 */
export function AdsGridSkeleton({
  count = 8,
  className,
  gridColsClass = "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
}: {
  count?: number;
  className?: string;
  gridColsClass?: string;
}) {
  return (
    <div className={cn("grid gap-3 lg:gap-4", gridColsClass, className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden border border-[var(--border)] bg-card"
          style={{ borderRadius: "var(--r)", boxShadow: "var(--shS)" }}
          aria-hidden="true"
        >
          <div className="animate-pulse bg-muted" style={{ aspectRatio: "4/3" }} />
          <div style={{ padding: "14px" }}>
            {/* Price (~19px) */}
            <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
            {/* Title — 2 lines, matches AdCard min-height 38px + 6/9px margins */}
            <div style={{ margin: "6px 0 9px" }} className="space-y-1.5">
              <div className="h-3.5 w-full animate-pulse rounded bg-muted" />
              <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
            </div>
            {/* Location row (~12.5px) */}
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            {/* Footer divider row */}
            <div
              className="flex items-center justify-between"
              style={{ marginTop: "11px", paddingTop: "10px", borderTop: "1px solid var(--border)" }}
            >
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              <div className="h-3 w-8 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
