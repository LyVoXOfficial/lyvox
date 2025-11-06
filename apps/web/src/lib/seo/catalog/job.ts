/**
 * SEO Metadata Generator for Job Listings
 */

import type { JobListing } from '@/lib/types/catalog';
import type { BaseAdvertData, SEOMetadata } from './common';
import {
  generateCanonicalUrl,
  generateSlug,
  truncateDescription,
  formatPrice,
} from './common';

interface JobAdvertData extends BaseAdvertData {
  specifics: JobListing;
}

/**
 * Generate SEO metadata for job listing
 */
export function generateJobSEO(data: JobAdvertData, lang: string = 'en'): SEOMetadata {
  const { specifics } = data;
  const slug = generateSlug(data.title);
  const canonical = generateCanonicalUrl(data.id, slug);
  
  // Generate rich title
  const titleParts = [
    data.title,
    specifics.company_name,
    data.location,
  ];
  const seoTitle = titleParts.filter(Boolean).join(' | ');
  
  // Generate rich description
  const descParts: string[] = [];
  
  // Employment type
  const employmentLabels = {
    full_time: lang === 'nl' ? 'Voltijds' : lang === 'fr' ? 'Temps plein' : 'Full-time',
    part_time: lang === 'nl' ? 'Deeltijds' : lang === 'fr' ? 'Temps partiel' : 'Part-time',
    freelance: lang === 'nl' ? 'Freelance' : lang === 'fr' ? 'Indépendant' : 'Freelance',
    internship: lang === 'nl' ? 'Stage' : lang === 'fr' ? 'Stage' : 'Internship',
  };
  descParts.push(employmentLabels[specifics.employment_type] || specifics.employment_type);
  
  // Remote option
  if (specifics.remote_option !== 'none') {
    const remoteLabels = {
      hybrid: lang === 'nl' ? 'Hybride' : lang === 'fr' ? 'Hybride' : 'Hybrid',
      full_remote: lang === 'nl' ? 'Remote' : lang === 'fr' ? 'Télétravail' : 'Remote',
    };
    descParts.push(remoteLabels[specifics.remote_option]);
  }
  
  // Salary
  if (specifics.salary_min && specifics.salary_max) {
    descParts.push(`€${specifics.salary_min}-${specifics.salary_max}`);
  } else if (specifics.salary_min) {
    descParts.push(`€${specifics.salary_min}+`);
  }
  
  // Languages
  if (specifics.languages_required && specifics.languages_required.length > 0) {
    descParts.push(specifics.languages_required.map(l => l.toUpperCase()).join('/'));
  }
  
  const richDescription = descParts.join(' • ');
  const fullDescription = `${richDescription}. ${truncateDescription(data.description, 120)}`;
  
  // Schema.org structured data
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: data.title,
    description: data.description,
    datePosted: data.created_at,
    ...(specifics.application_deadline && { validThrough: specifics.application_deadline }),
    employmentType: specifics.employment_type.toUpperCase().replace('_', '_'), // FULL_TIME, PART_TIME, etc.
    hiringOrganization: specifics.company_name ? {
      '@type': 'Organization',
      name: specifics.company_name,
    } : undefined,
    jobLocation: data.location ? {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: data.location,
        addressCountry: 'BE',
      },
    } : undefined,
    ...(specifics.salary_min && {
      baseSalary: {
        '@type': 'MonetaryAmount',
        currency: specifics.salary_currency || 'EUR',
        value: {
          '@type': 'QuantitativeValue',
          value: specifics.salary_min,
          ...(specifics.salary_max && { maxValue: specifics.salary_max }),
          unitText: specifics.salary_period?.toUpperCase() || 'YEAR',
        },
      },
    }),
    ...(specifics.experience_years_min && {
      experienceRequirements: {
        '@type': 'OccupationalExperienceRequirements',
        monthsOfExperience: specifics.experience_years_min * 12,
      },
    }),
    ...(specifics.education_level && specifics.education_level !== 'none' && {
      educationRequirements: {
        '@type': 'EducationalOccupationalCredential',
        credentialCategory: specifics.education_level,
      },
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
      card: 'summary',
      title: seoTitle,
      description: fullDescription,
    },
    structuredData,
  };
}

