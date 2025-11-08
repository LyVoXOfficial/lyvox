"use client";

import { useMemo } from "react";
import { useI18n } from "@/i18n";
import { FieldWidget } from "./FieldWidgets";
import type {
  CatalogFieldDefinition,
  CatalogSchema,
  CatalogSchemaField,
  CatalogSchemaGroup,
  CatalogFormRendererProps,
} from "./types";

function isFieldRequired(field: CatalogFieldDefinition, schemaField: CatalogSchemaField) {
  if (typeof schemaField.optional === "boolean") {
    return !schemaField.optional;
  }
  return field.is_required;
}

function groupLayoutClasses(group: CatalogSchemaGroup) {
  switch (group.layout) {
    case "double":
      return "grid gap-4 md:grid-cols-2";
    case "grid":
      return "grid gap-4 md:grid-cols-2 xl:grid-cols-3";
    default:
      return "space-y-4";
  }
}

export function FormRenderer({ schema, fields, values, onChange, locale, readonly }: CatalogFormRendererProps) {
  const { t } = useI18n();

  const steps = useMemo(() => schema.steps ?? [], [schema.steps]);

  if (!steps.length) {
    return (
      <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        {t("catalog.common.no_schema_defined")}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {steps.map((step) => (
        <div key={step.key} className="space-y-4">
          <div>
            {step.title_i18n_key && <h3 className="text-lg font-semibold">{t(step.title_i18n_key)}</h3>}
            {step.description_i18n_key && <p className="text-sm text-muted-foreground">{t(step.description_i18n_key)}</p>}
          </div>

          {step.groups?.map((group) => (
            <div key={group.key} className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
              <div>
                {group.title_i18n_key && <h4 className="text-base font-medium">{t(group.title_i18n_key)}</h4>}
                {group.description_i18n_key && (
                  <p className="text-sm text-muted-foreground">{t(group.description_i18n_key)}</p>
                )}
              </div>

              <div className={groupLayoutClasses(group)}>
                {group.fields?.map((schemaField) => {
                  const fieldDefinition = fields[schemaField.field_key];
                  if (!fieldDefinition) {
                    return (
                      <div key={schemaField.field_key} className="rounded border border-dashed p-4 text-sm text-muted-foreground">
                        {t("catalog.common.field_missing", { field: schemaField.field_key })}
                      </div>
                    );
                  }

                  const value = values[schemaField.field_key];
                  const required = isFieldRequired(fieldDefinition, schemaField);

                  return (
                    <div key={schemaField.field_key} className="space-y-1">
                      <FieldWidget
                        field={fieldDefinition}
                        schemaField={schemaField}
                        value={value}
                        onChange={(next) => onChange(schemaField.field_key, next)}
                        locale={locale}
                        readonly={readonly}
                      />
                      {required && <p className="text-[11px] uppercase text-primary">{t("catalog.common.required_indicator")}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export type { CatalogFormRendererProps, CatalogSchema };

