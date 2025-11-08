"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import type { CatalogFieldDefinition, CatalogFieldOption, CatalogSchemaField } from "./types";

type FieldWidgetProps = {
  field: CatalogFieldDefinition;
  schemaField: CatalogSchemaField;
  value: unknown;
  onChange: (value: unknown) => void;
  locale: string;
  readonly?: boolean;
};

function useFieldMeta(field: CatalogFieldDefinition, schemaField: CatalogSchemaField) {
  return useMemo(() => {
    const min = schemaField.min_value ?? (typeof field.min_value === "number" ? field.min_value : undefined);
    const max = schemaField.max_value ?? (typeof field.max_value === "number" ? field.max_value : undefined);
    const step = schemaField.step ?? (typeof field.metadata?.step === "number" ? (field.metadata.step as number) : undefined);

    return { min, max, step };
  }, [field, schemaField]);
}

function resolveLabelKey(field: CatalogFieldDefinition, schemaField: CatalogSchemaField) {
  return schemaField.label_i18n_key ?? field.label_i18n_key ?? `catalog.field.${field.field_key}.label`;
}

function resolveDescriptionKey(field: CatalogFieldDefinition, schemaField: CatalogSchemaField) {
  return schemaField.description_i18n_key ?? field.description_i18n_key ?? null;
}

function resolvePlaceholderKey(schemaField: CatalogSchemaField) {
  return schemaField.placeholder_i18n_key ?? null;
}

function TextWidget({ field, schemaField, value, onChange, readonly }: FieldWidgetProps) {
  const { t } = useI18n();
  const label = t(resolveLabelKey(field, schemaField));
  const descriptionKey = resolveDescriptionKey(field, schemaField);
  const placeholderKey = resolvePlaceholderKey(schemaField);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        value={(value as string) ?? ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholderKey ? t(placeholderKey) : undefined}
        readOnly={readonly}
      />
      {descriptionKey && <p className="text-xs text-muted-foreground">{t(descriptionKey)}</p>}
    </div>
  );
}

function TextareaWidget({ field, schemaField, value, onChange, readonly }: FieldWidgetProps) {
  const { t } = useI18n();
  const label = t(resolveLabelKey(field, schemaField));
  const descriptionKey = resolveDescriptionKey(field, schemaField);
  const placeholderKey = resolvePlaceholderKey(schemaField);
  const rows =
    (typeof schemaField.rows === "number" && schemaField.rows > 0 ? schemaField.rows : undefined) ??
    (typeof field.metadata?.rows === "number" ? (field.metadata.rows as number) : undefined) ??
    3;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea
        rows={rows}
        value={(value as string) ?? ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholderKey ? t(placeholderKey) : undefined}
        readOnly={readonly}
      />
      {descriptionKey && <p className="text-xs text-muted-foreground">{t(descriptionKey)}</p>}
    </div>
  );
}

function NumberWidget({ field, schemaField, value, onChange, readonly }: FieldWidgetProps) {
  const { t } = useI18n();
  const label = t(resolveLabelKey(field, schemaField));
  const descriptionKey = resolveDescriptionKey(field, schemaField);
  const placeholderKey = resolvePlaceholderKey(schemaField);
  const { min, max, step } = useFieldMeta(field, schemaField);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          type="number"
          value={value === null || value === undefined ? "" : (value as number)}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === "") {
              onChange(null);
              return;
            }
            const parsed = Number(raw);
            onChange(Number.isNaN(parsed) ? null : parsed);
          }}
          placeholder={placeholderKey ? t(placeholderKey) : undefined}
          min={min}
          max={max}
          step={step}
          readOnly={readonly}
        />
        {field.unit && <span className="self-center text-sm text-muted-foreground">{field.unit}</span>}
      </div>
      {descriptionKey && <p className="text-xs text-muted-foreground">{t(descriptionKey)}</p>}
    </div>
  );
}

function SelectWidget({ field, schemaField, value, onChange, readonly }: FieldWidgetProps) {
  const { t } = useI18n();
  const label = t(resolveLabelKey(field, schemaField));
  const descriptionKey = resolveDescriptionKey(field, schemaField);
  const placeholderKey = resolvePlaceholderKey(schemaField);
  const options = (field.options ?? []) as CatalogFieldOption[];
  const displayValue = typeof value === "string" ? value : "";

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={displayValue}
        onValueChange={(code) => onChange(code)}
        disabled={readonly}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholderKey ? t(placeholderKey) : t("catalog.common.select_placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.code} value={option.code}>
              {t(option.name_i18n_key)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {descriptionKey && <p className="text-xs text-muted-foreground">{t(descriptionKey)}</p>}
    </div>
  );
}

function BooleanWidget({ field, schemaField, value, onChange, readonly }: FieldWidgetProps) {
  const { t } = useI18n();
  const label = t(resolveLabelKey(field, schemaField));
  const descriptionKey = resolveDescriptionKey(field, schemaField);
  const checked = Boolean(value);

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <Checkbox checked={checked} onCheckedChange={(next) => onChange(Boolean(next))} disabled={readonly} />
        <div>
          <Label>{label}</Label>
          {descriptionKey && <p className="text-xs text-muted-foreground">{t(descriptionKey)}</p>}
        </div>
      </div>
    </div>
  );
}

function DateWidget({ field, schemaField, value, onChange, readonly }: FieldWidgetProps) {
  const { t } = useI18n();
  const label = t(resolveLabelKey(field, schemaField));
  const descriptionKey = resolveDescriptionKey(field, schemaField);
  const placeholderKey = resolvePlaceholderKey(schemaField);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="date"
        value={(value as string) ?? ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholderKey ? t(placeholderKey) : undefined}
        readOnly={readonly}
      />
      {descriptionKey && <p className="text-xs text-muted-foreground">{t(descriptionKey)}</p>}
    </div>
  );
}

export function FieldWidget(props: FieldWidgetProps) {
  const { field } = props;

  switch (field.field_type) {
    case "text":
      return <TextWidget {...props} />;
    case "textarea":
      return <TextareaWidget {...props} />;
    case "number":
      return <NumberWidget {...props} />;
    case "select":
      return <SelectWidget {...props} />;
    case "boolean":
      return <BooleanWidget {...props} />;
    case "date":
      return <DateWidget {...props} />;
    default:
      return <TextWidget {...props} />;
  }
}

