/**
 * Common SEO utilities for catalog
 */

import type { CatalogSpecifics } from '@/lib/types/catalog';

export interface BaseAdvertData {
  id: string;
  title: string;
  description: string;
  price?: number;
  currency?: string;
  location?: string;
  created_at: string;
  images?: string[];
  category_slug: string;
}

export interface SEOMetadata {
  title: string;
  description: string;
  canonical: string;
  openGraph: {
    title: string;
    description: string;
    type: string;
    images: Array<{
      url: string;
      width?: number;
      height?: number;
      alt: string;
    }>;
    locale: string;
    siteName: string;
  };
  twitter: {
    card: 'summary_large_image' | 'summary';
    title: string;
    description: string;
    images?: string[];
  };
  structuredData: Record<string, any>;
}

/**
 * Generate canonical URL
 */
export function generateCanonicalUrl(advertId: string, slug: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://lyvox.be';
  return `${baseUrl}/adverts/${advertId}/${slug}`;
}

/**
 * Generate URL-friendly slug from title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/--+/g, '-') // Replace multiple hyphens
    .trim();
}

/**
 * Truncate description for meta tags
 */
export function truncateDescription(text: string, maxLength: number = 160): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format price for display
 */
export function formatPrice(price: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency,
  }).format(price);
}

/**
 * Generate base Schema.org Thing
 */
export function generateBaseThing(data: BaseAdvertData) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product', // Base type, will be overridden by specific types
    name: data.title,
    description: data.description,
    image: data.images || [],
    offers: data.price ? {
      '@type': 'Offer',
      price: data.price,
      priceCurrency: data.currency || 'EUR',
      availability: 'https://schema.org/InStock',
    } : undefined,
  };
}

