/**
 * API Endpoint: Get Belgium CP Codes
 * GET /api/catalog/cp-codes
 * 
 * Returns list of Belgium CP codes (Paritair Comité / Commission Paritaire)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer();
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || 'en';
    const search = searchParams.get('search');
    
    let query = supabase
      .from('cp_codes')
      .select('*');
    
    // Search by code or name
    if (search) {
      const langField = `name_${lang}`;
      query = query.or(`code.ilike.%${search}%,${langField}.ilike.%${search}%`);
    }
    
    query = query.order('code');
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching CP codes:', error);
      return NextResponse.json(
        { error: 'Failed to fetch CP codes' },
        { status: 500 }
      );
    }
    
    const formatted = data.map((cp) => ({
      code: cp.code,
      name: cp[`name_${lang}`] || cp.name_en,
      sector: cp.sector,
    }));
    
    return NextResponse.json(formatted);
  } catch (error) {
    console.error('CP codes API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

