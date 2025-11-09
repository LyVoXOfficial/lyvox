/**
 * API Endpoint: Get Device Brands
 * GET /api/catalog/device-brands
 * 
 * Returns list of electronics brands (with optional filtering by device type)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { searchParams } = new URL(request.url);
    const deviceType = searchParams.get('device_type');
    const search = searchParams.get('search');

    let deviceTypeBrandIds: string[] | null = null;

    if (deviceType) {
      const { data: models, error: modelsError } = await supabase
        .from('device_models')
        .select('brand_id')
        .eq('device_type', deviceType);

      if (modelsError) {
        console.error('Error fetching device models:', modelsError);
        return NextResponse.json(
          { error: 'Failed to fetch device brands' },
          { status: 500 },
        );
      }

      deviceTypeBrandIds = Array.from(new Set((models ?? []).map((model) => model.brand_id)));
      if (!deviceTypeBrandIds.length) {
        return NextResponse.json([]);
      }
    }

    let query = supabase
      .from('device_brands')
      .select('id, slug, name, logo_url, country, website')
      .eq('is_active', true);

    if (deviceTypeBrandIds) {
      query = query.in('id', deviceTypeBrandIds);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, error } = await query.order('name');

    if (error) {
      console.error('Error fetching device brands:', error);
      return NextResponse.json(
        { error: 'Failed to fetch device brands' },
        { status: 500 },
      );
    }

    const formatted = (data ?? []).map((brand) => ({
      id: brand.id,
      slug: brand.slug,
      name: brand.name,
      logo_url: brand.logo_url,
      country: brand.country,
      website: brand.website,
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

