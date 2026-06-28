import type { CatalogFieldDefinition, CatalogSchemaGroup } from "@/catalog/renderer/types";

type AnySupabase = { from: (table: string) => any };

export async function loadCatalogGroups(
  domain: string,
  supabase: AnySupabase,
): Promise<{ groups: CatalogSchemaGroup[]; fields: Record<string, CatalogFieldDefinition> }> {
  const empty = { groups: [], fields: {} };

  const { data: groupRows, error: groupErr } = await supabase
    .from("catalog_groups")
    .select("group_key, display, tab_key, tab_order, label_i18n_key")
    .eq("domain", domain)
    .order("tab_order", { ascending: true });

  if (groupErr || !groupRows?.length) return empty;

  const groupKeys: string[] = (groupRows as any[]).map((g: any) => g.group_key);

  const { data: fieldRows, error: fieldErr } = await supabase
    .from("catalog_fields")
    .select(
      "id, field_key, label_i18n_key, description_i18n_key, field_type, domain, is_required, unit, min_value, max_value, pattern, group_key, sort, metadata",
    )
    .in("group_key", groupKeys)
    .order("sort", { ascending: true });

  if (fieldErr || !fieldRows?.length) return empty;

  const fieldIds: string[] = (fieldRows as any[]).map((f: any) => f.id);

  const { data: optionRows } = await supabase
    .from("catalog_field_options")
    .select("field_id, code, name_i18n_key, sort, metadata")
    .in("field_id", fieldIds);

  const optsByFieldId = ((optionRows ?? []) as any[]).reduce<Record<string, any[]>>(
    (acc, opt) => {
      if (!acc[opt.field_id]) acc[opt.field_id] = [];
      acc[opt.field_id].push(opt);
      return acc;
    },
    {},
  );

  const fields: Record<string, CatalogFieldDefinition> = {};
  for (const f of fieldRows as any[]) {
    fields[f.field_key] = {
      field_key: f.field_key,
      label_i18n_key: f.label_i18n_key,
      description_i18n_key: f.description_i18n_key,
      field_type: f.field_type,
      domain: f.domain,
      is_required: Boolean(f.is_required),
      unit: f.unit,
      min_value: f.min_value,
      max_value: f.max_value,
      pattern: f.pattern,
      group_key: f.group_key,
      sort: f.sort,
      metadata:
        f.metadata && typeof f.metadata === "object" && !Array.isArray(f.metadata)
          ? (f.metadata as Record<string, unknown>)
          : {},
      options: (optsByFieldId[f.id] ?? []).map((opt: any) => ({
        code: opt.code,
        name_i18n_key: opt.name_i18n_key,
        sort: opt.sort ?? null,
        metadata:
          opt.metadata && typeof opt.metadata === "object" && !Array.isArray(opt.metadata)
            ? (opt.metadata as Record<string, unknown>)
            : {},
      })),
    };
  }

  const groups: CatalogSchemaGroup[] = (groupRows as any[]).map((g) => ({
    key: g.group_key,
    title_i18n_key: g.label_i18n_key ?? undefined,
    display: g.display === "tab" || g.display === "section" ? g.display : "section",
    tab_key: g.tab_key ?? g.group_key,
    tab_order: g.tab_order ?? 0,
    fields: (fieldRows as any[])
      .filter((f) => f.group_key === g.group_key)
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
      .map((f) => ({ field_key: f.field_key })),
  }));

  return { groups, fields };
}
