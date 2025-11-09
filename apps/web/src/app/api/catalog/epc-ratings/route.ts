/**
 * API Endpoint: Get EPC Ratings
 * GET /api/catalog/epc-ratings
 * 
 * Returns list of Belgium EPC energy ratings with consumption ranges
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || 'en';
    
    const { data, error } = await supabase
      .from('epc_ratings')
      .select('code,label,color,description_en,description_fr,description_nl,max_kwh_per_sqm_year,sort_order')
      .order('sort_order');
    
    if (error) {
      console.error('Error fetching EPC ratings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch EPC ratings' },
        { status: 500 }
      );
    }
    
    // Return data with requested language
    type DescriptionField = 'description_en' | 'description_fr' | 'description_nl';
    const descriptionField: Record<'en' | 'fr' | 'nl', DescriptionField> = {
      en: 'description_en',
      fr: 'description_fr',
      nl: 'description_nl',
    };

    const normalizedLang = (['en', 'fr', 'nl'] as const).includes(lang as 'en' | 'fr' | 'nl')
      ? ((lang as 'en' | 'fr' | 'nl') ?? 'en')
      : 'en';

    const formatted = (data ?? []).map((rating) => ({
      code: rating.code,
      name: rating.label,
      description: rating[descriptionField[normalizedLang]] ?? rating.description_en,
      max_kwh_per_sqm_year: rating.max_kwh_per_sqm_year,
      color: rating.color,
      sort_order: rating.sort_order,
    }));
    
    return NextResponse.json(formatted);
  } catch (error) {
    console.error('EPC ratings API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

