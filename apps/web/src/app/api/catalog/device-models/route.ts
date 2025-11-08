/**
 * API Endpoint: Search Device Models
 * GET /api/catalog/device-models
 * 
 * Returns device models filtered by brand and type (for autocomplete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer();
    const { searchParams } = new URL(request.url);
    const brandParam = searchParams.get('brand') ?? searchParams.get('brand_id');
    const deviceType = searchParams.get('device_type');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    if (!brandParam || !deviceType) {
      return NextResponse.json(
        { error: 'brand and device_type parameters are required' },
        { status: 400 }
      );
    }
    
    // Use the PostgreSQL function for efficient search
    const { data, error } = await supabase.rpc('search_device_models', {
      p_brand_slug: brandParam,
      p_device_type: deviceType,
      p_search_term: search ?? undefined,
      p_limit: limit,
    });
    
    if (error) {
      console.error('Error fetching device models:', error);
      return NextResponse.json(
        { error: 'Failed to fetch device models' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Device models API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

