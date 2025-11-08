/**
 * API Endpoint: Get Job Contract Types
 * GET /api/catalog/contract-types
 * 
 * Returns list of Belgium job contract types
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import type { Tables } from '@/lib/supabaseTypes';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer();
    const { searchParams } = new URL(request.url);

    const SUPPORTED_LANGUAGES = ['en', 'fr', 'nl', 'ru', 'de'] as const;
    type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

    const resolveLang = (value: string | null): SupportedLanguage =>
      (SUPPORTED_LANGUAGES as readonly string[]).includes(value ?? '')
        ? ((value as SupportedLanguage) ?? 'en')
        : 'en';

    const lang = resolveLang(searchParams.get('lang'));

    const { data, error } = await supabase
      .from('job_contract_types')
      .select(
        'id, code, sort_order, name_en, name_fr, name_nl, name_de, name_ru, description_en, description_fr, description_nl',
      )
      .order('sort_order');

    if (error) {
      console.error('Error fetching contract types:', error);
      return NextResponse.json(
        { error: 'Failed to fetch contract types' },
        { status: 500 },
      );
    }

    type ContractType = Tables<'job_contract_types'>;
    type ContractNameField = 'name_en' | 'name_fr' | 'name_nl' | 'name_ru' | 'name_de';
    type ContractDescriptionField = 'description_en' | 'description_fr' | 'description_nl';

    const nameField: Record<SupportedLanguage, ContractNameField> = {
      en: 'name_en',
      fr: 'name_fr',
      nl: 'name_nl',
      ru: 'name_ru',
      de: 'name_de',
    };

    const descriptionField: Record<SupportedLanguage, ContractDescriptionField | null> = {
      en: 'description_en',
      fr: 'description_fr',
      nl: 'description_nl',
      ru: null,
      de: null,
    };

    const formatted = (data ?? []).map((type) => {
      const localizedName = type[nameField[lang]] ?? type.name_en;
      const descriptionKey = descriptionField[lang];
      const localizedDescription = descriptionKey ? type[descriptionKey] : type.description_en;

      return {
        id: type.id,
        code: type.code,
        slug: type.code,
        name: localizedName,
        description: localizedDescription,
        sort_order: type.sort_order,
      };
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Contract types API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

