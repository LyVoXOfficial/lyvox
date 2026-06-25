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
  className?: string;
};

export function MarketplaceEmptyState({
  title = "No listings found",
  description = "Try a broader search, clear one of the filters, or create the first listing for this market.",
  icon: Icon = Search,
  primaryAction,
  secondaryAction,
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
      {(primaryAction || secondaryAction) ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {primaryAction ? <EmptyActionButton action={primaryAction} fallbackIcon={SlidersHorizontal} /> : null}
          {secondaryAction ? <EmptyActionButton action={secondaryAction} fallbackIcon={Plus} /> : null}
        </div>
      ) : null}
    </div>
  );
}

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

export function AdsGridSkeleton({
  count = 8,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:gap-4", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-md border border-border/80 bg-card shadow-sm"
          aria-hidden="true"
        >
          <div className="aspect-[4/3] animate-pulse bg-muted" />
          <div className="space-y-3 p-3">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              <div className="h-3 w-12 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
