/**
 * API Endpoint: Get Job Categories
 * GET /api/catalog/job-categories
 * 
 * Returns list of job categories with translations
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
      .from('job_categories')
      .select('id, slug, name_en, name_fr, name_nl, name_de, name_ru, parent_id, is_active')
      .order('name_en');
    
    if (error) {
      console.error('Error fetching job categories:', error);
      return NextResponse.json(
        { error: 'Failed to fetch job categories' },
        { status: 500 }
      );
    }
    
    type CategoryNameField = 'name_en' | 'name_fr' | 'name_nl' | 'name_de' | 'name_ru';
    const SUPPORTED_LANGUAGES = ['en', 'fr', 'nl', 'de', 'ru'] as const;
    type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

    const resolveLang = (value: string | null): SupportedLanguage =>
      (SUPPORTED_LANGUAGES as readonly string[]).includes(value ?? '')
        ? ((value as SupportedLanguage) ?? 'en')
        : 'en';

    const resolvedLang = resolveLang(lang);

    const nameField: Record<SupportedLanguage, CategoryNameField> = {
      en: 'name_en',
      fr: 'name_fr',
      nl: 'name_nl',
      de: 'name_de',
      ru: 'name_ru',
    };

    const formatted = (data ?? []).map((category) => ({
      id: category.id,
      slug: category.slug,
      parent_id: category.parent_id,
      is_active: category.is_active,
      name: category[nameField[resolvedLang]] ?? category.name_en,
    }));
    
    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Job categories API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

