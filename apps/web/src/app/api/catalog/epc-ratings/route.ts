/**
 * API Endpoint: Get EPC Ratings
 * GET /api/catalog/epc-ratings
 * 
 * Returns list of Belgium EPC energy ratings with consumption ranges
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
      .from('epc_ratings')
      .select('*')
      .order('sort_order');
    
    if (error) {
      console.error('Error fetching EPC ratings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch EPC ratings' },
        { status: 500 }
      );
    }
    
    // Return data with requested language
    const formatted = data.map((rating) => ({
      code: rating.code,
      name: rating[`name_${lang}`] || rating.name_en,
      max_kwh_per_sqm_year: rating.max_kwh_per_sqm_year,
      color: rating.color_hex,
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

