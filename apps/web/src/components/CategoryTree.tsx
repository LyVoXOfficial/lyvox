"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";
import { getCategoryIcon } from "@/lib/categoryIcons";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type CategoryTreeProps = {
  variant?: "dropdown" | "drawer";
  onCategorySelect?: () => void;
};

/**
 * Category tree node type matching the API response
 * The API already provides localized names and tree structure
 */
type CategoryTreeNode = {
  id: string;
  parent_id: string | null;
  slug: string;
  level: number;
  name: string; // Localized name from API
  path: string;
  sort: number | null;
  icon: string | null;
  is_active: boolean | null;
  children?: CategoryTreeNode[];
};

type CategoriesTreeResponse = {
  ok: boolean;
  data?: {
    tree: CategoryTreeNode[];
    locale: string;
    count: number;
  };
  error?: string;
};

export default function CategoryTree({ variant = "dropdown", onCategorySelect }: CategoryTreeProps) {
  const { t, locale } = useI18n();
  const [tree, setTree] = useState<CategoryTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchCategoriesTree() {
      try {
        // Use the API endpoint which provides localized tree structure
        const response = await fetch(`/api/categories/tree?locale=${locale}`, {
          cache: "force-cache", // Use cached data when available
        });

        if (!cancelled) {
          if (!response.ok) {
            console.error("Failed to fetch categories tree:", response.statusText);
            setTree([]);
            setLoading(false);
            return;
          }

          const result: CategoriesTreeResponse = await response.json();

          if (!result.ok || !result.data) {
            console.error("API error:", result.error || "Unknown error");
            setTree([]);
          } else {
            // API already returns a tree with localized names
            setTree(result.data.tree);
          }
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error fetching categories tree:", err);
          setTree([]);
          setLoading(false);
        }
      }
    }

    fetchCategoriesTree();

    return () => {
      cancelled = true;
    };
  }, [locale]); // Re-fetch when locale changes

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderCategory = (cat: CategoryTreeNode, level: number = 0): React.ReactNode => {
    const hasChildren = cat.children && cat.children.length > 0;
    const isExpanded = expanded.has(cat.id);
    const Icon = getCategoryIcon(cat.icon, cat.level);
    const name = cat.name; // Already localized from API
    const href = `/c/${cat.path}`;

    if (variant === "dropdown") {
      return (
        <div key={cat.id} className={cn("relative", level > 0 && "ml-4")}>
          <div className="flex items-center group">
            {hasChildren && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleExpand(cat.id);
                }}
                className="p-1 hover:bg-muted rounded transition-colors"
                aria-label={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                )}
              </button>
            )}
            {!hasChildren && <span className="w-5" />}
            <Link
              href={href}
              onClick={onCategorySelect}
              className={cn(
                "flex items-center gap-2 flex-1 px-2 py-1.5 rounded-md text-sm transition-colors",
                "hover:bg-muted",
                level === 0 && "font-medium"
              )}
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span>{name}</span>
            </Link>
          </div>
          {hasChildren && isExpanded && (
            <div className="mt-1 space-y-1">
              {cat.children!.map((child) => renderCategory(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    // Drawer variant
    return (
      <div key={cat.id} className={cn(level > 0 && "ml-4")}>
        <Link
          href={href}
          onClick={onCategorySelect}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
            "hover:bg-muted",
            level === 0 && "font-medium"
          )}
        >
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1">{name}</span>
          {hasChildren && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleExpand(cat.id);
              }}
              className="p-1"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          )}
        </Link>
        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-1">
            {cat.children!.map((child) => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {t("common.loading") || "Загрузка…"}
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {t("common.categories") || "Категории"} {t("common.loading") || "недоступны"}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn(variant === "dropdown" && "w-64 max-h-96 overflow-y-auto")}>
      <div className="space-y-1 p-2">
        {tree.map((cat) => renderCategory(cat))}
      </div>
    </div>
  );
}
