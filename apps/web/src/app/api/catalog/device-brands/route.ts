/**
 * API Endpoint: Get Device Brands
 * GET /api/catalog/device-brands
 * 
 * Returns list of electronics brands (with optional filtering by device type)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const deviceType = searchParams.get('device_type');
    const search = searchParams.get('search');
    
    let query = supabase
      .from('device_brands')
      .select('*')
      .eq('is_active', true);
    
    // Filter by device type if provided
    if (deviceType) {
      query = query.contains('device_types', [deviceType]);
    }
    
    // Search by name
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }
    
    query = query.order('name');
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching device brands:', error);
      return NextResponse.json(
        { error: 'Failed to fetch device brands' },
        { status: 500 }
      );
    }
    
    const formatted = data.map((brand) => ({
      id: brand.id,
      slug: brand.slug,
      name: brand.name,
      logo_url: brand.logo_url,
      device_types: brand.device_types,
    }));
    
    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Device brands API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

