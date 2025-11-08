export type CatalogFieldOption = {
  code: string;
  name_i18n_key: string;
  sort: number | null;
  metadata: Record<string, unknown>;
};

export type CatalogFieldDefinition = {
  field_key: string;
  label_i18n_key: string | null;
  description_i18n_key: string | null;
  field_type: string;
  domain: string | null;
  is_required: boolean;
  unit: string | null;
  min_value: number | null;
  max_value: number | null;
  pattern: string | null;
  group_key: string | null;
  sort: number | null;
  metadata: Record<string, unknown>;
  options?: CatalogFieldOption[];
};

export type CatalogSchemaField = {
  field_key: string;
  optional?: boolean;
  label_i18n_key?: string;
  description_i18n_key?: string;
  placeholder_i18n_key?: string;
  prefix_i18n_key?: string;
  suffix_i18n_key?: string;
  min_value?: number;
  max_value?: number;
  step?: number;
  [key: string]: unknown;
};

export type CatalogSchemaGroup = {
  key: string;
  title_i18n_key?: string;
  description_i18n_key?: string;
  layout?: "single" | "double" | "grid";
  fields?: CatalogSchemaField[];
  [key: string]: unknown;
};

export type CatalogSchemaStep = {
  key: string;
  title_i18n_key?: string;
  description_i18n_key?: string;
  groups?: CatalogSchemaGroup[];
  [key: string]: unknown;
};

export type CatalogSchema = {
  version: number;
  steps: CatalogSchemaStep[];
};

export type CatalogFormRendererProps = {
  schema: CatalogSchema;
  fields: Record<string, CatalogFieldDefinition>;
  values: Record<string, unknown>;
  onChange: (fieldKey: string, value: unknown) => void;
  locale: string;
  readonly?: boolean;
};

