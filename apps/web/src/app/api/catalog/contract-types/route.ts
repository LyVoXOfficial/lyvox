/**
 * API Endpoint: Get Job Contract Types
 * GET /api/catalog/contract-types
 * 
 * Returns list of Belgium job contract types
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
      .from('job_contract_types')
      .select('*')
      .order('sort_order');
    
    if (error) {
      console.error('Error fetching contract types:', error);
      return NextResponse.json(
        { error: 'Failed to fetch contract types' },
        { status: 500 }
      );
    }
    
    const formatted = data.map((type) => ({
      id: type.id,
      slug: type.slug,
      name: type[`name_${lang}`] || type.name_en,
      description: type[`description_${lang}`] || type.description_en,
      sort_order: type.sort_order,
    }));
    
    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Contract types API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

