import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: string;
  href: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  className?: string;
  showHome?: boolean;
  homeLabel?: string;
  homeHref?: string;
};

/**
 * Breadcrumbs component for navigation
 * Supports dynamic category paths with localization
 */
export default function Breadcrumbs({
  items,
  className,
  showHome = true,
  homeLabel = "Главная",
  homeHref = "/",
}: BreadcrumbsProps) {
  if (!items.length && !showHome) {
    return null;
  }

  const allItems: BreadcrumbItem[] = showHome
    ? [{ label: homeLabel, href: homeHref }, ...items]
    : items;

  return (
    <nav
      className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center gap-2" itemScope itemType="https://schema.org/BreadcrumbList">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;

          return (
            <li
              key={`${item.href}-${index}`}
              className="flex items-center gap-2"
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              {index === 0 && showHome ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                  itemProp="item"
                >
                  <Home className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">{item.label}</span>
                </Link>
              ) : isLast ? (
                <span className="text-foreground font-medium" itemProp="name">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-foreground hover:underline transition-colors"
                  itemProp="item"
                >
                  <span itemProp="name">{item.label}</span>
                </Link>
              )}
              <meta itemProp="position" content={(index + 1).toString()} />
              {!isLast && (
                <ChevronRight
                  className="h-4 w-4 text-muted-foreground/50"
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

