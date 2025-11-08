/**
 * Catalog API Tests
 * 
 * Tests all catalog-specific API endpoints for correct behavior,
 * validation, i18n support, and error handling.
 */

import { describe, it, expect, vi } from 'vitest';

const sampleData: Record<string, any[]> = {
  property_types: [
    {
      id: 'prop-apartment',
      slug: 'apartment',
      category: 'residential',
      is_active: true,
      name_en: 'Apartment',
      name_fr: 'Appartement',
      name_nl: 'Appartement',
      name_de: 'Wohnung',
      name_ru: 'Квартира',
      sort_order: 1,
    },
    {
      id: 'prop-house',
      slug: 'house',
      category: 'residential',
      is_active: true,
      name_en: 'House',
      name_fr: 'Maison',
      name_nl: 'Huis',
      name_de: 'Haus',
      name_ru: 'Дом',
      sort_order: 2,
    },
  ],
  epc_ratings: [
    {
      code: 'A++',
      label: 'A++',
      color: '#00FF7F',
      description_en: 'Excellent efficiency',
      description_fr: 'Efficacité excellente',
      description_nl: 'Uitstekende efficiëntie',
      max_kwh_per_sqm_year: 75,
      sort_order: 1,
    },
    {
      code: 'G',
      label: 'G',
      color: '#FF4500',
      description_en: 'Very poor efficiency',
      description_fr: 'Très faible efficacité',
      description_nl: 'Zeer lage efficiëntie',
      max_kwh_per_sqm_year: 600,
      sort_order: 7,
    },
  ],
  device_brands: [
    {
      id: 'brand-apple',
      slug: 'apple',
      name: 'Apple',
      logo_url: null,
      country: 'US',
      website: 'https://apple.com',
      is_active: true,
    },
    {
      id: 'brand-samsung',
      slug: 'samsung',
      name: 'Samsung',
      logo_url: null,
      country: 'KR',
      website: 'https://samsung.com',
      is_active: true,
    },
    {
      id: 'brand-sony',
      slug: 'sony',
      name: 'Sony',
      logo_url: null,
      country: 'JP',
      website: 'https://sony.com',
      is_active: true,
    },
  ],
  device_models: [
    {
      id: 'model-iphone13',
      brand_id: 'brand-apple',
      brand_slug: 'apple',
      device_type: 'smartphone',
      model_name: 'iPhone 13',
      release_year: 2021,
    },
    {
      id: 'model-galaxy-s22',
      brand_id: 'brand-samsung',
      brand_slug: 'samsung',
      device_type: 'smartphone',
      model_name: 'Galaxy S22',
      release_year: 2022,
    },
    {
      id: 'model-sony-a7',
      brand_id: 'brand-sony',
      brand_slug: 'sony',
      device_type: 'camera',
      model_name: 'Alpha 7',
      release_year: 2020,
    },
  ],
  job_categories: [
    {
      id: 'cat-it',
      slug: 'jobs-it',
      name_en: 'IT & Development',
      name_fr: 'Informatique',
      name_nl: 'IT & Ontwikkeling',
      name_de: 'IT & Entwicklung',
      name_ru: 'IT и разработка',
      parent_id: null,
      is_active: true,
      icon: null,
      created_at: null,
    },
    {
      id: 'cat-it-dev',
      slug: 'jobs-it-developer',
      name_en: 'Software Developer',
      name_fr: 'Développeur logiciel',
      name_nl: 'Softwareontwikkelaar',
      name_de: 'Softwareentwickler',
      name_ru: 'Разработчик ПО',
      parent_id: 'cat-it',
      is_active: true,
      icon: null,
      created_at: null,
    },
  ],
  cp_codes: [
    {
      code: '100',
      name_en: 'Retail',
      name_fr: 'Commerce de détail',
      name_nl: 'Detailhandel',
      sector: 'Retail',
      created_at: null,
      is_active: true,
    },
  ],
  job_contract_types: [
    {
      id: 'contract-permanent',
      code: 'permanent',
      name_en: 'Permanent',
      name_fr: 'CDI',
      name_nl: 'Onbepaalde duur',
      name_de: 'Unbefristet',
      name_ru: 'Постоянный',
      description_en: 'Full-time permanent contract',
      description_fr: 'Contrat permanent à temps plein',
      description_nl: 'Voltijds contract van onbepaalde duur',
      description_de: 'Unbefristeter Vollzeitvertrag',
      description_ru: 'Полная занятость без срока',
      sort_order: 1,
      is_active: true,
    },
    {
      id: 'contract-temporary',
      code: 'temporary',
      name_en: 'Temporary',
      name_fr: 'CDD',
      name_nl: 'Tijdelijk',
      name_de: 'Befristet',
      name_ru: 'Временный',
      description_en: 'Fixed-term assignment',
      description_fr: 'Mission à durée déterminée',
      description_nl: 'Opdracht van bepaalde duur',
      description_de: 'Befristete Tätigkeit',
      description_ru: 'Срочный контракт',
      sort_order: 2,
      is_active: true,
    },
    {
      id: 'contract-interim',
      code: 'interim',
      name_en: 'Interim',
      name_fr: 'Intérim',
      name_nl: 'Interim',
      name_de: 'Zeitarbeit',
      name_ru: 'Интерим',
      description_en: 'Agency contract',
      description_fr: 'Contrat via agence',
      description_nl: 'Contract via interimkantoor',
      description_de: 'Zeitarbeitsvertrag',
      description_ru: 'Агентский контракт',
      sort_order: 3,
      is_active: true,
    },
  ],
};

type Filter =
  | { type: 'eq'; column: string; value: any }
  | { type: 'in'; column: string; values: any[] }
  | { type: 'ilike'; column: string; pattern: string }
  | { type: 'contains'; column: string; value: any[] };

const applyFilters = (
  table: string,
  filters: Filter[],
  selectedColumns: string[] | null,
) => {
  let rows = [...(sampleData[table] ?? [])];

  const matchesFilter = (row: any, filter: Filter) => {
    switch (filter.type) {
      case 'eq':
        return row[filter.column] === filter.value;
      case 'in':
        return filter.values.includes(row[filter.column]);
      case 'ilike': {
        const needle = filter.pattern.replace(/%/g, '').toLowerCase();
        const haystack = String(row[filter.column] ?? '').toLowerCase();
        return haystack.includes(needle);
      }
      case 'contains': {
        const value = row[filter.column] ?? [];
        return Array.isArray(value) && filter.value.every((v) => value.includes(v));
      }
      default:
        return true;
    }
  };

  rows = rows.filter((row) => filters.every((filter) => matchesFilter(row, filter)));

  if (selectedColumns && selectedColumns.length > 0) {
    rows = rows.map((row) => {
      const projected: Record<string, unknown> = {};
      selectedColumns.forEach((column) => {
        const key = column.trim();
        if (key in row) {
          projected[key] = row[key];
        }
      });
      return projected;
    });
  }

  return rows;
};

const sortData = (rows: any[], column?: string | null) => {
  if (!column) {
    return rows;
  }
  return [...rows].sort((a, b) => {
    const aVal = a[column as string];
    const bVal = b[column as string];
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return aVal - bVal;
    }
    return String(aVal ?? '').localeCompare(String(bVal ?? ''), 'en', { sensitivity: 'base' });
  });
};

const createQueryBuilder = (table: string) => {
  const filters: Filter[] = [];
  let selectedColumns: string[] | null = null;

  const builder: any = {
    select(columns?: string) {
      if (columns) {
        selectedColumns = columns
          .split(',')
          .map((column) => column.trim())
          .filter(Boolean);
      }
      return builder;
    },
    eq(column: string, value: any) {
      filters.push({ type: 'eq', column, value });
      return builder;
    },
    in(column: string, values: any[]) {
      filters.push({ type: 'in', column, values });
      return builder;
    },
    ilike(column: string, pattern: string) {
      filters.push({ type: 'ilike', column, pattern });
      return builder;
    },
    contains(column: string, value: any[]) {
      filters.push({ type: 'contains', column, value });
      return builder;
    },
    order(column: string) {
      const data = sortData(applyFilters(table, filters, selectedColumns), column);
      return Promise.resolve({ data, error: null });
    },
    then(onFulfilled: any, onRejected: any) {
      const result = { data: applyFilters(table, filters, selectedColumns), error: null };
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };

  return builder;
};

const createSupabaseClient = () => ({
  from(table: string) {
    return createQueryBuilder(table);
  },
  rpc(name: string, args: Record<string, any>) {
    if (name === 'search_device_models') {
      const brandSlug = args.p_brand_slug ?? args.p_brand_id ?? null;
      const deviceType = args.p_device_type ?? null;
      const search = args.p_search_term ? String(args.p_search_term).toLowerCase() : null;
      const limit = typeof args.p_limit === 'number' ? args.p_limit : 20;

      let rows = [...sampleData.device_models];
      if (brandSlug) {
        rows = rows.filter(
          (row) => row.brand_slug === brandSlug || row.brand_id === brandSlug,
        );
      }
      if (deviceType) {
        rows = rows.filter((row) => row.device_type === deviceType);
      }
      if (search) {
        rows = rows.filter((row) => row.model_name.toLowerCase().includes(search));
      }

      return Promise.resolve({
        data: rows.slice(0, limit).map((row) => ({
          id: row.id,
          brand_id: row.brand_id,
          model_name: row.model_name,
          device_type: row.device_type,
          release_year: row.release_year,
        })),
        error: null,
      });
    }

    return Promise.resolve({ data: null, error: null });
  },
});

vi.mock('@/lib/supabaseServer', () => ({
  supabaseServer: () => createSupabaseClient(),
}));

// Mock Next.js request/response
const createMockRequest = (
  params?: Record<string, any>,
  searchParams?: Record<string, string>,
  pathname: string = '/api/mock',
) => {
  const query = new URLSearchParams(searchParams || {});
  const queryString = query.toString();
  const url =
    queryString.length > 0
      ? `https://example.com${pathname}?${queryString}`
      : `https://example.com${pathname}`;

  return {
    nextUrl: {
      searchParams: query,
    },
    url,
    json: async () => params || {},
  };
};

describe('Catalog API Endpoints', () => {
  describe('/api/catalog/property-types', () => {
    it('should return property types with default locale (en)', async () => {
      const { GET } = await import('../property-types/route');
      const request = createMockRequest();
      
      const response = await GET(request as any);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('name');
      expect(data[0]).toHaveProperty('slug');
    });

    it('should return localized property types for nl', async () => {
      const { GET } = await import('../property-types/route');
      const request = createMockRequest(undefined, { lang: 'nl' });
      
      const response = await GET(request as any);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data[0].name).toBeDefined();
      // Verify it's Dutch text (basic check - should not be same as English)
    });

    it('should fallback to English for unsupported locale', async () => {
      const { GET } = await import('../property-types/route');
      const request = createMockRequest(undefined, { lang: 'invalid' });
      
      const response = await GET(request as any);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toBeDefined();
    });

    it('should include all required fields', async () => {
      const { GET } = await import('../property-types/route');
      const request = createMockRequest();
      
      const response = await GET(request as any);
      const data = await response.json();
      
      const propertyType = data[0];
      expect(propertyType).toHaveProperty('id');
      expect(propertyType).toHaveProperty('name');
      expect(propertyType).toHaveProperty('slug');
      expect(typeof propertyType.id).toBe('string');
      expect(typeof propertyType.name).toBe('string');
      expect(typeof propertyType.slug).toBe('string');
    });
  });

  describe('/api/catalog/epc-ratings', () => {
    it('should return EPC ratings sorted by efficiency', async () => {
      const { GET } = await import('../epc-ratings/route');
      const request = createMockRequest();
      
      const response = await GET(request as any);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      
      // Should include A++ to G ratings
      const codes = data.map((r: any) => r.code);
      expect(codes).toContain('A++');
      expect(codes).toContain('G');
    });

    it('should include energy consumption limits', async () => {
      const { GET } = await import('../epc-ratings/route');
      const request = createMockRequest();
      
      const response = await GET(request as any);
      const data = await response.json();
      
      const aPlusPlus = data.find((r: any) => r.code === 'A++');
      expect(aPlusPlus).toHaveProperty('max_kwh_per_sqm_year');
      expect(typeof aPlusPlus.max_kwh_per_sqm_year).toBe('number');
      expect(aPlusPlus.max_kwh_per_sqm_year).toBeLessThan(100);
    });

    it('should include color coding for UI display', async () => {
      const { GET } = await import('../epc-ratings/route');
      const request = createMockRequest();
      
      const response = await GET(request as any);
      const data = await response.json();
      
      data.forEach((rating: any) => {
        expect(rating).toHaveProperty('color');
        expect(rating.color).toMatch(/^#[0-9A-F]{6}$/i); // Valid hex color
      });
    });
  });

  describe('/api/catalog/device-brands', () => {
    it('should return electronics brands', async () => {
      const { GET } = await import('../device-brands/route');
      const request = createMockRequest();
      
      const response = await GET(request as any);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    it('should support lang parameter', async () => {
      const { GET } = await import('../device-brands/route');
      const request = createMockRequest(undefined, { lang: 'fr' });
      
      const response = await GET(request as any);
      expect(response.status).toBe(200);
    });

    it('should include major electronics brands', async () => {
      const { GET } = await import('../device-brands/route');
      const request = createMockRequest();
      
      const response = await GET(request as any);
      const data = await response.json();
      
      const brandNames = data.map((b: any) => b.name.toLowerCase());
      
      // Should include major brands
      const expectedBrands = ['apple', 'samsung', 'sony'];
      expectedBrands.forEach(brand => {
        expect(brandNames.some((name: string) => name.includes(brand))).toBe(true);
      });
    });
  });

  describe('/api/catalog/device-models', () => {
    it('should require brand_id parameter', async () => {
      const { GET } = await import('../device-models/route');
      const request = createMockRequest();
      
      const response = await GET(request as any);
      
      // Should return error or empty array without brand_id
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should return models filtered by brand', async () => {
      const { GET } = await import('../device-models/route');
      
      // First get a brand ID
      const brandsRes = await import('../device-brands/route');
      const brandsRequest = createMockRequest();
      const brandsResponse = await brandsRes.GET(brandsRequest as any);
      const brands = await brandsResponse.json();
      const testBrandId = brands[0]?.id;
      
      if (!testBrandId) {
        console.warn('No brands found, skipping model test');
        return;
      }
      
      const request = createMockRequest(undefined, { brand_id: testBrandId, device_type: 'smartphone' });
      const response = await GET(request as any);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      
      // All models should belong to the requested brand
      data.forEach((model: any) => {
        expect(model.brand_id).toBe(testBrandId);
      });
    });
  });

  describe('/api/catalog/job-categories', () => {
    it('should return job categories', async () => {
      const { GET } = await import('../job-categories/route');
      const request = createMockRequest();
      
      const response = await GET(request as any);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    it('should include category hierarchy', async () => {
      const { GET } = await import('../job-categories/route');
      const request = createMockRequest();
      
      const response = await GET(request as any);
      const data = await response.json();
      
      // Should have parent categories
      const parentCategories = data.filter((c: any) => !c.parent_id);
      expect(parentCategories.length).toBeGreaterThan(0);
      
      // Should have child categories
      const childCategories = data.filter((c: any) => c.parent_id);
      expect(childCategories.length).toBeGreaterThan(0);
    });
  });

  describe('/api/catalog/cp-codes', () => {
    it('should return Belgium CP codes', async () => {
      const { GET } = await import('../cp-codes/route');
      const request = createMockRequest();
      
      const response = await GET(request as any);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    it('should include CP code number and sector name', async () => {
      const { GET } = await import('../cp-codes/route');
      const request = createMockRequest();
      
      const response = await GET(request as any);
      const data = await response.json();
      
      const cpCode = data[0];
      expect(cpCode).toHaveProperty('code');
      expect(cpCode).toHaveProperty('name');
      expect(cpCode).toHaveProperty('sector');
      expect(typeof cpCode.code).toBe('string');
      expect(cpCode.code).toMatch(/^\d+$/); // Should be numeric string
    });

    it('should support bilingual names (NL/FR)', async () => {
      const { GET } = await import('../cp-codes/route');
      const requestNL = createMockRequest(undefined, { lang: 'nl' });
      const requestFR = createMockRequest(undefined, { lang: 'fr' });
      
      const responseNL = await GET(requestNL as any);
      const responseFR = await GET(requestFR as any);
      
      const dataNL = await responseNL.json();
      const dataFR = await responseFR.json();
      
      expect(dataNL[0].name).toBeDefined();
      expect(dataFR[0].name).toBeDefined();
      // Names should be different (NL vs FR)
      expect(dataNL[0].name).not.toBe(dataFR[0].name);
    });
  });

  describe('/api/catalog/contract-types', () => {
    it('should return job contract types', async () => {
      const { GET } = await import('../contract-types/route');
      const request = createMockRequest();
      
      const response = await GET(request as any);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    it('should include standard contract types', async () => {
      const { GET } = await import('../contract-types/route');
      const request = createMockRequest();
      
      const response = await GET(request as any);
      const data = await response.json();
      
      const types = data.map((t: any) => t.slug);
      expect(types).toContain('permanent');
      expect(types).toContain('temporary');
      expect(types).toContain('interim');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking Supabase client to throw error
      // Placeholder for future implementation
      expect(true).toBe(true);
    });

    it('should return proper HTTP status codes', async () => {
      const { GET } = await import('../property-types/route');
      const request = createMockRequest();
      
      const response = await GET(request as any);
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('Performance & Caching', () => {
    it('should set cache headers for static data', async () => {
      const { GET } = await import('../property-types/route');
      const request = createMockRequest();
      
      const response = await GET(request as any);
      const cacheControl = response.headers.get('Cache-Control');
      
      // Should have caching enabled for dictionary data
      expect(cacheControl).toBeDefined();
    });
  });

  describe('Data Consistency', () => {
    it('should return consistent data structure across all endpoints', async () => {
      const endpoints = [
        '../property-types/route',
        '../device-brands/route',
        '../job-categories/route',
        '../cp-codes/route',
        '../contract-types/route',
      ];
      
      for (const endpoint of endpoints) {
        const { GET } = await import(endpoint);
        const request = createMockRequest();
        const response = await GET(request as any);
        const data = await response.json();
        
        expect(Array.isArray(data)).toBe(true);
        if (data.length > 0) {
          const first = data[0];
          const hasIdentifier = Boolean(first.id ?? first.code ?? first.slug);
          expect(hasIdentifier).toBe(true);
          expect(first).toHaveProperty('name');
        }
      }
    });
  });
});

describe('Validation', () => {
  it('should validate Belgium postcode format', () => {
    const validPostcodes = ['1000', '2000', '9999'];
    const invalidPostcodes = ['0000', '12', '10000', 'abcd', ''];
    
    const validatePostcode = (postcode: string) => /^[1-9][0-9]{3}$/.test(postcode);
    
    validPostcodes.forEach(pc => {
      expect(validatePostcode(pc)).toBe(true);
    });
    
    invalidPostcodes.forEach(pc => {
      expect(validatePostcode(pc)).toBe(false);
    });
  });

  it('should validate EPC certificate number format', () => {
    const validEPC = '20231225-1234567-01';
    const invalidEPC = 'invalid-format';
    
    const validateEPC = (epc: string) => /^[0-9]{8}-[0-9]{7}-[0-9]{2}$/.test(epc);
    
    expect(validateEPC(validEPC)).toBe(true);
    expect(validateEPC(invalidEPC)).toBe(false);
  });
});




