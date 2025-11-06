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
      .select('*')
      .order('sort_order');
    
    if (error) {
      console.error('Error fetching job categories:', error);
      return NextResponse.json(
        { error: 'Failed to fetch job categories' },
        { status: 500 }
      );
    }
    
    const formatted = data.map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category[`name_${lang}`] || category.name_en,
      sort_order: category.sort_order,
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

