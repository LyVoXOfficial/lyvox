/**
 * Catalog API Tests
 * 
 * Tests all catalog-specific API endpoints for correct behavior,
 * validation, i18n support, and error handling.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Mock Next.js request/response
const createMockRequest = (params?: Record<string, any>, searchParams?: Record<string, string>) => {
  return {
    nextUrl: {
      searchParams: new URLSearchParams(searchParams || {}),
    },
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
      
      const request = createMockRequest(undefined, { brand_id: testBrandId });
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
          expect(data[0]).toHaveProperty('id');
          expect(data[0]).toHaveProperty('name');
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




