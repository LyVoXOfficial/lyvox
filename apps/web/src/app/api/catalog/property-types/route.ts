/**
 * API Endpoint: Get Property Types
 * GET /api/catalog/property-types
 * 
 * Returns list of property types with translations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || 'en';
    
    const { data, error } = await supabase
      .from('property_types')
      .select('*')
      .order('sort_order');
    
    if (error) {
      console.error('Error fetching property types:', error);
      return NextResponse.json(
        { error: 'Failed to fetch property types' },
        { status: 500 }
      );
    }
    
    // Return data with requested language
    const formatted = data.map((type) => ({
      id: type.id,
      slug: type.slug,
      name: type[`name_${lang}`] || type.name_en,
      category: type.category,
      sort_order: type.sort_order,
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

