"use client";

import { useState } from "react";
import { useI18n } from "@/i18n";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FieldWidget } from "./FieldWidgets";
import type {
  CatalogFieldDefinition,
  CatalogSchemaField,
  CatalogSchemaGroup,
} from "./types";

function isFieldRequired(field: CatalogFieldDefinition, schemaField: CatalogSchemaField) {
  if (typeof schemaField.optional === "boolean") return !schemaField.optional;
  return field.is_required;
}

function groupLayoutClasses(group: CatalogSchemaGroup) {
  switch (group.layout) {
    case "double": return "grid gap-4 md:grid-cols-2";
    case "grid":   return "grid gap-4 md:grid-cols-2 xl:grid-cols-3";
    default:       return "space-y-4";
  }
}

type GroupBodyProps = {
  group: CatalogSchemaGroup;
  fields: Record<string, CatalogFieldDefinition>;
  values: Record<string, unknown>;
  onChange: (fieldKey: string, value: unknown) => void;
  locale: string;
  readonly?: boolean;
};

function GroupBody({ group, fields, values, onChange, locale, readonly }: GroupBodyProps) {
  const { t } = useI18n();
  return (
    <div className={groupLayoutClasses(group)}>
      {group.fields?.map((schemaField) => {
        const fieldDefinition = fields[schemaField.field_key];
        if (!fieldDefinition) {
          return (
            <div
              key={schemaField.field_key}
              className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground"
            >
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
            {required && (
              <p className="text-[11px] uppercase text-primary">
                {t("catalog.common.required_indicator")}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

type CatalogGroupTabsProps = {
  groups: CatalogSchemaGroup[];
  fields: Record<string, CatalogFieldDefinition>;
  values: Record<string, unknown>;
  onChange: (fieldKey: string, value: unknown) => void;
  locale: string;
  readonly?: boolean;
};

/**
 * F13: Renders a list of catalog groups as ARIA tabs (when display='tab')
 * or stacked sections (when display='section' or unset).
 *
 * Mixed steps (some tab, some section) are normalized: if ANY group in the
 * list is display='tab' the whole step uses the tabs layout; otherwise sections.
 */
export function CatalogGroupTabs({
  groups,
  fields,
  values,
  onChange,
  locale,
  readonly,
}: CatalogGroupTabsProps) {
  const { t } = useI18n();

  const tabGroups = groups
    .filter((g) => g.display === "tab")
    .sort((a, b) => (a.tab_order ?? 0) - (b.tab_order ?? 0));

  const useTabs = tabGroups.length > 0;

  const [activeTab, setActiveTab] = useState<string>(
    tabGroups[0]?.tab_key ?? tabGroups[0]?.key ?? ""
  );

  if (useTabs) {
    const defaultTab = tabGroups[0]?.tab_key ?? tabGroups[0]?.key ?? "";
    return (
      <Tabs value={activeTab || defaultTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          {tabGroups.map((group) => {
            const tabValue = group.tab_key ?? group.key;
            const label = group.title_i18n_key ? t(group.title_i18n_key) : group.key;
            return (
              <TabsTrigger key={tabValue} value={tabValue}>
                {label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {tabGroups.map((group) => {
          const tabValue = group.tab_key ?? group.key;
          return (
            <TabsContent
              key={tabValue}
              value={tabValue}
              className="rounded-xl border border-border/70 bg-card p-4 shadow-[var(--shadow-soft)]"
            >
              {group.description_i18n_key && (
                <p className="mb-3 text-sm text-muted-foreground">
                  {t(group.description_i18n_key)}
                </p>
              )}
              <GroupBody
                group={group}
                fields={fields}
                values={values}
                onChange={onChange}
                locale={locale}
                readonly={readonly}
              />
            </TabsContent>
          );
        })}
      </Tabs>
    );
  }

  // Section layout (fashion, home, electronics)
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div
          key={group.key}
          className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-[var(--shadow-soft)]"
        >
          {group.title_i18n_key && (
            <h4 className="text-base font-medium">{t(group.title_i18n_key)}</h4>
          )}
          {group.description_i18n_key && (
            <p className="text-sm text-muted-foreground">{t(group.description_i18n_key)}</p>
          )}
          <GroupBody
            group={group}
            fields={fields}
            values={values}
            onChange={onChange}
            locale={locale}
            readonly={readonly}
          />
        </div>
      ))}
    </div>
  );
}
