/**
 * SEO Metadata Generator for Electronics
 */

import type { ElectronicsSpecifics } from '@/lib/types/catalog';
import type { BaseAdvertData, SEOMetadata } from './common';
import {
  generateCanonicalUrl,
  generateSlug,
  truncateDescription,
  formatPrice,
} from './common';

interface ElectronicsAdvertData extends BaseAdvertData {
  specifics: ElectronicsSpecifics;
}

/**
 * Generate SEO metadata for electronics listing
 */
export function generateElectronicsSEO(data: ElectronicsAdvertData, lang: string = 'en'): SEOMetadata {
  const { specifics } = data;
  const slug = generateSlug(data.title);
  const canonical = generateCanonicalUrl(data.id, slug);
  
  // Generate rich title
  const titleParts = [
    specifics.brand,
    specifics.model,
    specifics.storage_gb ? `${specifics.storage_gb}GB` : null,
    specifics.condition,
  ];
  const seoTitle = titleParts.filter(Boolean).join(' • ');
  
  // Generate rich description
  const descParts: string[] = [];
  
  // Storage & Memory
  if (specifics.storage_gb) {
    descParts.push(`${specifics.storage_gb}GB`);
  }
  if (specifics.memory_gb) {
    descParts.push(`${specifics.memory_gb}GB RAM`);
  }
  
  // Condition
  const conditionLabels = {
    new: lang === 'nl' ? 'Nieuw' : lang === 'fr' ? 'Neuf' : 'New',
    like_new: lang === 'nl' ? 'Als nieuw' : lang === 'fr' ? 'Comme neuf' : 'Like New',
    good: lang === 'nl' ? 'Goed' : lang === 'fr' ? 'Bon' : 'Good',
    fair: lang === 'nl' ? 'Redelijk' : lang === 'fr' ? 'Acceptable' : 'Fair',
    for_parts: lang === 'nl' ? 'Voor onderdelen' : lang === 'fr' ? 'Pour pièces' : 'For Parts',
  };
  descParts.push(conditionLabels[specifics.condition]);
  
  // Price
  if (data.price) {
    descParts.push(formatPrice(data.price));
  }
  
  // Extras
  const extras: string[] = [];
  if (specifics.original_box) {
    extras.push(lang === 'nl' ? 'met doos' : lang === 'fr' ? 'avec boîte' : 'with box');
  }
  if (specifics.warranty_until) {
    extras.push(lang === 'nl' ? 'garantie' : lang === 'fr' ? 'garantie' : 'warranty');
  }
  if (extras.length > 0) {
    descParts.push(`(${extras.join(', ')})`);
  }
  
  const richDescription = descParts.join(' • ');
  const fullDescription = `${richDescription}. ${truncateDescription(data.description, 120)}`;
  
  // Schema.org structured data
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${specifics.brand} ${specifics.model}`,
    brand: {
      '@type': 'Brand',
      name: specifics.brand,
    },
    model: specifics.model,
    description: data.description,
    ...(data.images && data.images.length > 0 && { image: data.images }),
    ...(specifics.release_year && { releaseDate: `${specifics.release_year}-01-01` }),
    offers: data.price ? {
      '@type': 'Offer',
      price: data.price,
      priceCurrency: data.currency || 'EUR',
      availability: 'https://schema.org/InStock',
      itemCondition: `https://schema.org/${specifics.condition === 'new' ? 'NewCondition' : 'UsedCondition'}`,
    } : undefined,
    additionalProperty: [
      ...(specifics.storage_gb ? [{
        '@type': 'PropertyValue',
        name: 'Storage',
        value: `${specifics.storage_gb} GB`,
      }] : []),
      ...(specifics.memory_gb ? [{
        '@type': 'PropertyValue',
        name: 'Memory',
        value: `${specifics.memory_gb} GB`,
      }] : []),
      ...(specifics.processor ? [{
        '@type': 'PropertyValue',
        name: 'Processor',
        value: specifics.processor,
      }] : []),
    ],
  };
  
  return {
    title: seoTitle,
    description: fullDescription,
    canonical,
    openGraph: {
      title: seoTitle,
      description: fullDescription,
      type: 'product',
      images: data.images?.map((url, index) => ({
        url,
        width: 1200,
        height: 630,
        alt: `${specifics.brand} ${specifics.model} - ${index + 1}`,
      })) || [],
      locale: lang === 'nl' ? 'nl_BE' : 'fr_BE',
      siteName: 'LyVoX',
    },
    twitter: {
      card: 'summary_large_image',
      title: seoTitle,
      description: fullDescription,
      images: data.images?.slice(0, 1),
    },
    structuredData,
  };
}

