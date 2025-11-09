/**
 * API Endpoint: Get Belgium CP Codes
 * GET /api/catalog/cp-codes
 * 
 * Returns list of Belgium CP codes (Paritair Comité / Commission Paritaire)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import type { Tables } from '@/lib/supabaseTypes';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { searchParams } = new URL(request.url);
    const SUPPORTED_LANGUAGES = ['en', 'fr', 'nl'] as const;
    type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

    const resolveLang = (value: string | null): SupportedLanguage =>
      (SUPPORTED_LANGUAGES as readonly string[]).includes(value ?? '')
        ? ((value as SupportedLanguage) ?? 'en')
        : 'en';

    const lang = resolveLang(searchParams.get('lang'));
    const search = searchParams.get('search');

    const { data, error } = await supabase
      .from('cp_codes')
      .select('code, name_en, name_fr, name_nl, sector')
      .order('code');

    if (error) {
      console.error('Error fetching CP codes:', error);
      return NextResponse.json(
        { error: 'Failed to fetch CP codes' },
        { status: 500 },
      );
    }

    type CpCode = Tables<'cp_codes'>;

    type CpCodeNameField = 'name_en' | 'name_fr' | 'name_nl';

    const nameField: Record<SupportedLanguage, CpCodeNameField> = {
      en: 'name_en',
      fr: 'name_fr',
      nl: 'name_nl',
    };

    const filtered = (data ?? []).filter((cp) => {
      if (!search) return true;
      const normalizedSearch = search.toLowerCase();
      const localizedName = (cp[nameField[lang]] ?? cp.name_en ?? '').toLowerCase();
      return (
        cp.code.toLowerCase().includes(normalizedSearch) ||
        localizedName.includes(normalizedSearch)
      );
    });

    const formatted = filtered.map((cp) => {
      const localizedName = cp[nameField[lang]] ?? cp.name_en ?? '';

      return {
        code: cp.code,
        name: localizedName,
        sector: cp.sector,
      };
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('CP codes API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

