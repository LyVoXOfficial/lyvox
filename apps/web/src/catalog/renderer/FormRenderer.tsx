"use client";

import { useMemo } from "react";
import { useI18n } from "@/i18n";
import { CatalogGroupTabs } from "./CatalogGroupTabs";
import type { CatalogSchema, CatalogFormRendererProps } from "./types";

export function FormRenderer({ schema, fields, values, onChange, locale, readonly }: CatalogFormRendererProps) {
  const { t } = useI18n();

  const steps = useMemo(() => schema.steps ?? [], [schema.steps]);

  if (!steps.length) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
        {t("catalog.common.no_schema_defined")}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {steps.map((step) => (
        <div key={step.key} className="space-y-4">
          <div>
            {step.title_i18n_key && (
              <h3 className="text-lg font-extrabold tracking-tight">{t(step.title_i18n_key)}</h3>
            )}
            {step.description_i18n_key && (
              <p className="text-sm text-muted-foreground">{t(step.description_i18n_key)}</p>
            )}
          </div>

          {/* F13: CatalogGroupTabs renders as ARIA tabs or sections based on group.display */}
          {step.groups && step.groups.length > 0 && (
            <CatalogGroupTabs
              groups={step.groups}
              fields={fields}
              values={values}
              onChange={onChange}
              locale={locale}
              readonly={readonly}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export type { CatalogFormRendererProps, CatalogSchema };

