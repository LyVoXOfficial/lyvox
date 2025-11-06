/**
 * SEO Metadata Generator for Real Estate
 */

import type { PropertyListing } from '@/lib/types/catalog';
import type { BaseAdvertData, SEOMetadata } from './common';
import {
  generateCanonicalUrl,
  generateSlug,
  truncateDescription,
  formatPrice,
} from './common';

interface PropertyAdvertData extends BaseAdvertData {
  specifics: PropertyListing;
}

/**
 * Generate SEO metadata for property listing
 */
export function generatePropertySEO(data: PropertyAdvertData, lang: string = 'en'): SEOMetadata {
  const { specifics } = data;
  const slug = generateSlug(data.title);
  const canonical = generateCanonicalUrl(data.id, slug);
  
  // Generate rich title
  const titleParts = [
    data.title,
    specifics.listing_type === 'sale' ? (lang === 'nl' ? 'Te koop' : 'À vendre') : (lang === 'nl' ? 'Te huur' : 'À louer'),
    specifics.municipality,
  ];
  const seoTitle = titleParts.filter(Boolean).join(' | ');
  
  // Generate rich description
  const descParts = [
    `${specifics.area_sqm}m²`,
    specifics.rooms ? `${specifics.rooms} ${lang === 'nl' ? 'kamers' : 'pièces'}` : null,
    specifics.bedrooms ? `${specifics.bedrooms} ${lang === 'nl' ? 'slaapkamers' : 'chambres'}` : null,
    specifics.epc_rating ? `EPC ${specifics.epc_rating}` : null,
    data.price ? (specifics.listing_type === 'sale' ? formatPrice(data.price) : `€${data.price}/mois`) : null,
    specifics.postcode,
  ];
  const richDescription = descParts.filter(Boolean).join(' • ');
  const fullDescription = `${richDescription}. ${truncateDescription(data.description, 120)}`;
  
  // Schema.org structured data
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': specifics.listing_type === 'sale' ? 'RealEstateListing' : 'RentAction',
    name: data.title,
    description: data.description,
    ...(data.images && data.images.length > 0 && { image: data.images }),
    address: {
      '@type': 'PostalAddress',
      addressLocality: specifics.municipality,
      postalCode: specifics.postcode,
      addressCountry: 'BE',
    },
    floorSize: {
      '@type': 'QuantitativeValue',
      value: specifics.area_sqm,
      unitCode: 'MTK', // Square meter
    },
    ...(specifics.rooms && { numberOfRooms: specifics.rooms }),
    ...(specifics.bedrooms && { numberOfBedrooms: specifics.bedrooms }),
    ...(specifics.bathrooms && { numberOfBathroomsTotal: specifics.bathrooms }),
    ...(specifics.year_built && { yearBuilt: specifics.year_built }),
    ...(data.price && {
      offers: {
        '@type': 'Offer',
        price: data.price,
        priceCurrency: data.currency || 'EUR',
        availability: 'https://schema.org/InStock',
        ...(specifics.listing_type === 'rent' && {
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: data.price,
            priceCurrency: 'EUR',
            unitText: 'MONTH',
          },
        }),
      },
    }),
    ...(specifics.epc_rating && {
      additionalProperty: [
        {
          '@type': 'PropertyValue',
          name: 'Energy Performance Certificate',
          value: specifics.epc_rating,
        },
      ],
    }),
  };
  
  return {
    title: seoTitle,
    description: fullDescription,
    canonical,
    openGraph: {
      title: seoTitle,
      description: fullDescription,
      type: 'website',
      images: data.images?.map((url, index) => ({
        url,
        width: 1200,
        height: 630,
        alt: `${data.title} - ${index + 1}`,
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

/**
 * Generate property listing title template
 */
export function generatePropertyTitle(specifics: PropertyListing, lang: string = 'en'): string {
  const parts: string[] = [];
  
  // Type
  // parts.push(specifics.property_type); // Requires translation
  
  // Rooms
  if (specifics.rooms) {
    parts.push(`${specifics.rooms} ${lang === 'nl' ? 'kamers' : lang === 'fr' ? 'pièces' : 'rooms'}`);
  }
  
  // Area
  parts.push(`${specifics.area_sqm}m²`);
  
  // Location
  parts.push(specifics.municipality);
  
  return parts.join(' • ');
}

