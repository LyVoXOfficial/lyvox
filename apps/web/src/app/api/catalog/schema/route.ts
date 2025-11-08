import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type SchemaStep = {
  key: string;
  groups?: Array<{
    key: string;
    fields?: Array<{ field_key: string } & Record<string, unknown>>;
  }>;
  [key: string]: unknown;
};

function collectFieldKeys(steps: unknown): string[] {
  if (!Array.isArray(steps)) return [];

  const keys = new Set<string>();

  for (const step of steps as SchemaStep[]) {
    if (!step?.groups) continue;
    for (const group of step.groups) {
      if (!group?.fields) continue;
      for (const field of group.fields) {
        if (field && typeof field.field_key === "string") {
          keys.add(field.field_key);
        }
      }
    }
  }

  return Array.from(keys);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer();
    const { searchParams } = new URL(request.url);
    const categoryIdParam = searchParams.get("category_id");
    const categorySlug = searchParams.get("category_slug");

    if (!categoryIdParam && !categorySlug) {
      return NextResponse.json(
        {
          ok: false,
          error: "category_id or category_slug is required",
        },
        { status: 400 },
      );
    }

    let categoryQuery = supabase
      .from("categories")
      .select("id, slug, name_ru, name_en, name_fr, name_nl, path, icon, parent_id, level")
      .eq("is_active", true)
      .limit(1);

    if (categoryIdParam) {
      categoryQuery = categoryQuery.eq("id", categoryIdParam);
    } else if (categorySlug) {
      categoryQuery = categoryQuery.eq("slug", categorySlug);
    }

    const { data: categoryRows, error: categoryError } = await categoryQuery;

    if (categoryError) {
      console.error("catalog/schema category error:", categoryError);
      return NextResponse.json({ ok: false, error: "Failed to load category" }, { status: 500 });
    }

    const category = categoryRows?.[0];

    if (!category) {
      return NextResponse.json({ ok: false, error: "Category not found" }, { status: 404 });
    }

    const { data: schemaRows, error: schemaError } = await supabase
      .from("catalog_subcategory_schema")
      .select("id, version, is_active, steps")
      .eq("category_id", category.id)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1);

    if (schemaError) {
      console.error("catalog/schema load error:", schemaError);
      return NextResponse.json({ ok: false, error: "Failed to load schema" }, { status: 500 });
    }

    const schemaRow = schemaRows?.[0];
    if (!schemaRow) {
      return NextResponse.json(
        {
          ok: false,
          error: "Schema not found for category",
        },
        { status: 404 },
      );
    }

    const steps = schemaRow.steps ?? [];
    const fieldKeys = collectFieldKeys(steps);

    let fieldsPayload: Record<
      string,
      {
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
        options?: Array<{
          code: string;
          name_i18n_key: string;
          sort: number | null;
          metadata: Record<string, unknown>;
        }>;
      }
    > = {};

    if (fieldKeys.length > 0) {
      const { data: fieldRows, error: fieldError } = await supabase
        .from("catalog_fields")
        .select("id, field_key, label_i18n_key, description_i18n_key, field_type, domain, is_required, unit, min_value, max_value, pattern, group_key, sort, metadata")
        .in("field_key", fieldKeys);

      if (fieldError) {
        console.error("catalog/schema fields error:", fieldError);
        return NextResponse.json({ ok: false, error: "Failed to load fields" }, { status: 500 });
      }

      const fieldIds = fieldRows?.map((row) => row.id) ?? [];

      let optionsByField: Record<string, Array<any>> = {};
      if (fieldIds.length > 0) {
        const { data: optionRows, error: optionError } = await supabase
          .from("catalog_field_options")
          .select("field_id, code, name_i18n_key, sort, metadata")
          .in("field_id", fieldIds);

        if (optionError) {
          console.error("catalog/schema field options error:", optionError);
          return NextResponse.json({ ok: false, error: "Failed to load field options" }, { status: 500 });
        }

        optionsByField = (optionRows ?? []).reduce<Record<string, Array<any>>>((acc, option) => {
          if (!acc[option.field_id]) {
            acc[option.field_id] = [];
          }
          acc[option.field_id].push(option);
          return acc;
        }, {});
      }

      fieldsPayload = (fieldRows ?? []).reduce<typeof fieldsPayload>((acc, field) => {
        acc[field.field_key] = {
          field_key: field.field_key,
          label_i18n_key: field.label_i18n_key,
          description_i18n_key: field.description_i18n_key,
          field_type: field.field_type,
          domain: field.domain,
          is_required: field.is_required,
          unit: field.unit,
          min_value: field.min_value,
          max_value: field.max_value,
          pattern: field.pattern,
          group_key: field.group_key,
          sort: field.sort,
          metadata: field.metadata ?? {},
          options: (optionsByField[field.id] ?? []).map((opt) => ({
            code: opt.code,
            name_i18n_key: opt.name_i18n_key,
            sort: opt.sort,
            metadata: opt.metadata ?? {},
          })),
        };
        return acc;
      }, {});
    }

    return NextResponse.json({
      ok: true,
      data: {
        category,
        schema: {
          id: schemaRow.id,
          version: schemaRow.version,
          steps,
        },
        fields: fieldsPayload,
      },
    });
  } catch (error) {
    console.error("catalog/schema unexpected error:", error);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

