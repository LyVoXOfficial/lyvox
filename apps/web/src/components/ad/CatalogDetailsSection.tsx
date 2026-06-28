"use client";

import { CatalogGroupTabs } from "@/catalog/renderer/CatalogGroupTabs";
import type { CatalogFieldDefinition, CatalogSchemaGroup } from "@/catalog/renderer/types";

type Props = {
  groups: CatalogSchemaGroup[];
  fields: Record<string, CatalogFieldDefinition>;
  values: Record<string, unknown>;
  locale: string;
};

export function CatalogDetailsSection({ groups, fields, values, locale }: Props) {
  if (!groups.length) return null;
  return (
    <section className="rounded-md border border-border/80 bg-card p-4 shadow-sm">
      <CatalogGroupTabs
        groups={groups}
        fields={fields}
        values={values}
        onChange={() => {}}
        locale={locale}
        readonly
      />
    </section>
  );
}
