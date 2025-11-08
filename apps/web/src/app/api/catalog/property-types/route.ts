/**
 * API Endpoint: Get Property Types
 * GET /api/catalog/property-types
 * 
 * Returns list of property types with translations
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer();
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || 'en';
    
    const { data, error } = await supabase
      .from('property_types')
      .select('id, slug, category, name_en, name_fr, name_nl, name_de, name_ru, is_active')
      .order('name_en');
    
    if (error) {
      console.error('Error fetching property types:', error);
      return NextResponse.json(
        { error: 'Failed to fetch property types' },
        { status: 500 }
      );
    }
    
    // Return data with requested language
    const SUPPORTED_LANGUAGES = ['en', 'fr', 'nl', 'de', 'ru'] as const;
    type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
    type PropertyNameField = 'name_en' | 'name_fr' | 'name_nl' | 'name_de' | 'name_ru';

    const resolveLang = (value: string | null): SupportedLanguage =>
      (SUPPORTED_LANGUAGES as readonly string[]).includes(value ?? '')
        ? ((value as SupportedLanguage) ?? 'en')
        : 'en';

    const resolvedLang = resolveLang(lang);

    const nameField: Record<SupportedLanguage, PropertyNameField> = {
      en: 'name_en',
      fr: 'name_fr',
      nl: 'name_nl',
      de: 'name_de',
      ru: 'name_ru',
    };

    const formatted = (data ?? []).map((type) => ({
      id: type.id,
      slug: type.slug,
      category: type.category,
      is_active: type.is_active,
      name: type[nameField[resolvedLang]] ?? type.name_en,
    }));
    
    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Property types API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

