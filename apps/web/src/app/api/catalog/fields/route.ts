/**
 * API Endpoint: Get Category Fields
 * GET /api/catalog/fields?category={slug}&lang={lang}
 * 
 * Returns field definitions for a given category (for dynamic form rendering)
 * This is the central endpoint for all catalog-specific forms
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCategoryType, usesSpecializedTable } from '@/lib/types/catalog';

export const dynamic = 'force-dynamic';

interface FieldDefinition {
  name: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'checkbox' | 'date' | 'textarea' | 'range';
  label: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: string; label: string }>;
  helpText?: string;
  validation?: string; // Regex pattern or validation rule
  group?: string; // Field grouping for UI
  conditional?: { field: string; value: any }; // Show only if condition met
  hidden?: boolean; // Hidden from public (e.g., IMEI, serial number)
}

interface CategoryFieldsResponse {
  category_slug: string;
  category_type: string;
  uses_specialized_table: boolean;
  field_groups: Array<{
    name: string;
    label: string;
    fields: FieldDefinition[];
  }>;
}

/**
 * Get field definitions for real estate
 */
function getRealEstateFields(lang: string = 'en'): CategoryFieldsResponse {
  return {
    category_slug: 'real-estate',
    category_type: 'property',
    uses_specialized_table: true,
    field_groups: [
      {
        name: 'basic',
        label: 'Basic Information',
        fields: [
          {
            name: 'property_type',
            type: 'select',
            label: 'Property Type',
            required: true,
            options: [], // Populated from API /api/catalog/property-types
          },
          {
            name: 'listing_type',
            type: 'select',
            label: 'Listing Type',
            required: true,
            options: [
              { value: 'sale', label: 'For Sale' },
              { value: 'rent', label: 'For Rent' },
            ],
          },
        ],
      },
      {
        name: 'dimensions',
        label: 'Dimensions',
        fields: [
          {
            name: 'area_sqm',
            type: 'number',
            label: 'Living Area (m²)',
            required: true,
            min: 1,
            max: 10000,
            step: 0.1,
          },
          {
            name: 'land_area_sqm',
            type: 'number',
            label: 'Land Area (m²)',
            min: 0,
            step: 0.1,
            helpText: 'For houses and land only',
          },
          {
            name: 'rooms',
            type: 'number',
            label: 'Total Rooms',
            min: 0,
            max: 20,
          },
          {
            name: 'bedrooms',
            type: 'number',
            label: 'Bedrooms',
            min: 0,
            max: 15,
          },
          {
            name: 'bathrooms',
            type: 'number',
            label: 'Bathrooms',
            min: 0,
            max: 10,
            step: 0.5,
            helpText: 'Use 0.5 for half bathrooms',
          },
        ],
      },
      {
        name: 'building',
        label: 'Building Information',
        fields: [
          {
            name: 'year_built',
            type: 'number',
            label: 'Year Built',
            min: 1800,
            max: new Date().getFullYear(),
          },
          {
            name: 'renovation_year',
            type: 'number',
            label: 'Renovation Year',
            min: 1800,
            max: new Date().getFullYear(),
          },
          {
            name: 'floor',
            type: 'number',
            label: 'Floor',
            min: -3,
            max: 150,
            helpText: 'Negative numbers for basement',
          },
          {
            name: 'total_floors',
            type: 'number',
            label: 'Total Floors in Building',
            min: 1,
          },
        ],
      },
      {
        name: 'energy',
        label: 'Energy Performance (Belgium EPC)',
        fields: [
          {
            name: 'epc_rating',
            type: 'select',
            label: 'EPC Rating',
            options: [], // Populated from /api/catalog/epc-ratings
            helpText: 'Energy Performance Certificate rating',
          },
          {
            name: 'epc_cert_number',
            type: 'text',
            label: 'EPC Certificate Number',
            placeholder: 'YYYYMMDD-NNNNNNN-NN',
            validation: '^[0-9]{8}-[0-9]{7}-[0-9]{2}$',
          },
          {
            name: 'epc_kwh_per_sqm_year',
            type: 'number',
            label: 'Energy Consumption (kWh/m²/year)',
            min: 0,
          },
          {
            name: 'double_glazing',
            type: 'checkbox',
            label: 'Double Glazing',
          },
        ],
      },
      {
        name: 'rental',
        label: 'Rental Details',
        fields: [
          {
            name: 'rent_monthly',
            type: 'number',
            label: 'Monthly Rent (€)',
            required: true,
            min: 0,
            conditional: { field: 'listing_type', value: 'rent' },
          },
          {
            name: 'rent_charges_monthly',
            type: 'number',
            label: 'Monthly Charges (€)',
            min: 0,
            conditional: { field: 'listing_type', value: 'rent' },
          },
          {
            name: 'deposit_months',
            type: 'number',
            label: 'Security Deposit (months)',
            min: 0,
            max: 3,
            step: 0.5,
            helpText: 'Maximum 3 months per Belgium law',
            conditional: { field: 'listing_type', value: 'rent' },
          },
          {
            name: 'furnished',
            type: 'select',
            label: 'Furnished Status',
            options: [
              { value: 'unfurnished', label: 'Unfurnished' },
              { value: 'semi_furnished', label: 'Semi-Furnished' },
              { value: 'fully_furnished', label: 'Fully Furnished' },
            ],
            conditional: { field: 'listing_type', value: 'rent' },
          },
          {
            name: 'available_from',
            type: 'date',
            label: 'Available From',
            conditional: { field: 'listing_type', value: 'rent' },
          },
        ],
      },
      {
        name: 'location',
        label: 'Location',
        fields: [
          {
            name: 'postcode',
            type: 'text',
            label: 'Postcode',
            required: true,
            validation: '^[1-9][0-9]{3}$',
            helpText: '4-digit Belgian postcode',
          },
          {
            name: 'municipality',
            type: 'text',
            label: 'Municipality',
            required: true,
          },
          {
            name: 'neighborhood',
            type: 'text',
            label: 'Neighborhood',
          },
        ],
      },
      {
        name: 'features',
        label: 'Features',
        fields: [
          {
            name: 'parking_spaces',
            type: 'number',
            label: 'Parking Spaces',
            min: 0,
            max: 10,
          },
          {
            name: 'terrace_sqm',
            type: 'number',
            label: 'Terrace Area (m²)',
            min: 0,
          },
          {
            name: 'garden_sqm',
            type: 'number',
            label: 'Garden Area (m²)',
            min: 0,
          },
          {
            name: 'elevator',
            type: 'checkbox',
            label: 'Elevator',
          },
          {
            name: 'cellar',
            type: 'checkbox',
            label: 'Cellar/Storage',
          },
        ],
      },
    ],
  };
}

/**
 * Get field definitions for electronics
 */
function getElectronicsFields(lang: string = 'en'): CategoryFieldsResponse {
  return {
    category_slug: 'electronics',
    category_type: 'electronics',
    uses_specialized_table: false,
    field_groups: [
      {
        name: 'basic',
        label: 'Device Information',
        fields: [
          {
            name: 'device_type',
            type: 'select',
            label: 'Device Type',
            required: true,
            options: [
              { value: 'phone', label: 'Phone' },
              { value: 'tablet', label: 'Tablet' },
              { value: 'laptop', label: 'Laptop' },
              { value: 'desktop', label: 'Desktop' },
              { value: 'camera', label: 'Camera' },
              { value: 'tv', label: 'TV' },
              { value: 'audio', label: 'Audio Equipment' },
              { value: 'console', label: 'Gaming Console' },
              { value: 'watch', label: 'Smartwatch' },
              { value: 'monitor', label: 'Monitor' },
              { value: 'printer', label: 'Printer' },
            ],
          },
          {
            name: 'brand',
            type: 'select',
            label: 'Brand',
            required: true,
            options: [], // Populated from /api/catalog/device-brands
          },
          {
            name: 'model',
            type: 'text',
            label: 'Model',
            required: true,
          },
          {
            name: 'release_year',
            type: 'number',
            label: 'Release Year',
            min: 2000,
            max: new Date().getFullYear() + 1,
          },
        ],
      },
      {
        name: 'specs',
        label: 'Technical Specifications',
        fields: [
          {
            name: 'memory_gb',
            type: 'select',
            label: 'RAM/Memory (GB)',
            options: [
              { value: '2', label: '2 GB' },
              { value: '4', label: '4 GB' },
              { value: '6', label: '6 GB' },
              { value: '8', label: '8 GB' },
              { value: '12', label: '12 GB' },
              { value: '16', label: '16 GB' },
              { value: '32', label: '32 GB' },
              { value: '64', label: '64 GB' },
            ],
          },
          {
            name: 'storage_gb',
            type: 'select',
            label: 'Storage (GB)',
            options: [
              { value: '64', label: '64 GB' },
              { value: '128', label: '128 GB' },
              { value: '256', label: '256 GB' },
              { value: '512', label: '512 GB' },
              { value: '1024', label: '1 TB' },
              { value: '2048', label: '2 TB' },
            ],
          },
          {
            name: 'screen_size_inch',
            type: 'number',
            label: 'Screen Size (inches)',
            min: 3,
            max: 150,
            step: 0.1,
          },
        ],
      },
      {
        name: 'condition',
        label: 'Condition',
        fields: [
          {
            name: 'condition',
            type: 'select',
            label: 'Overall Condition',
            required: true,
            options: [
              { value: 'new', label: 'New' },
              { value: 'like_new', label: 'Like New' },
              { value: 'good', label: 'Good' },
              { value: 'fair', label: 'Fair' },
              { value: 'for_parts', label: 'For Parts' },
            ],
          },
          {
            name: 'battery_condition',
            type: 'select',
            label: 'Battery Condition',
            options: [
              { value: 'excellent', label: 'Excellent (90-100%)' },
              { value: 'good', label: 'Good (80-89%)' },
              { value: 'average', label: 'Average (70-79%)' },
              { value: 'poor', label: 'Poor (<70%)' },
              { value: 'needs_replacement', label: 'Needs Replacement' },
            ],
            conditional: { field: 'device_type', value: ['phone', 'tablet', 'laptop', 'watch'] },
          },
        ],
      },
      {
        name: 'extras',
        label: 'Extras & Warranty',
        fields: [
          {
            name: 'original_box',
            type: 'checkbox',
            label: 'Original Box',
          },
          {
            name: 'original_charger',
            type: 'checkbox',
            label: 'Original Charger',
          },
          {
            name: 'warranty_until',
            type: 'date',
            label: 'Warranty Valid Until',
          },
        ],
      },
    ],
  };
}

/**
 * Get field definitions for jobs
 */
function getJobFields(lang: string = 'en'): CategoryFieldsResponse {
  return {
    category_slug: 'jobs',
    category_type: 'job',
    uses_specialized_table: true,
    field_groups: [
      {
        name: 'basic',
        label: 'Job Information',
        fields: [
          {
            name: 'job_category',
            type: 'select',
            label: 'Job Category',
            required: true,
            options: [], // Populated from /api/catalog/job-categories
          },
          {
            name: 'contract_type',
            type: 'select',
            label: 'Contract Type',
            required: true,
            options: [], // Populated from /api/catalog/contract-types
          },
          {
            name: 'employment_type',
            type: 'select',
            label: 'Employment Type',
            required: true,
            options: [
              { value: 'full_time', label: 'Full-Time' },
              { value: 'part_time', label: 'Part-Time' },
              { value: 'freelance', label: 'Freelance' },
              { value: 'internship', label: 'Internship' },
            ],
          },
          {
            name: 'remote_option',
            type: 'select',
            label: 'Remote Work',
            options: [
              { value: 'none', label: 'On-Site Only' },
              { value: 'hybrid', label: 'Hybrid' },
              { value: 'full_remote', label: 'Fully Remote' },
            ],
          },
        ],
      },
      {
        name: 'compensation',
        label: 'Compensation',
        fields: [
          {
            name: 'salary_min',
            type: 'number',
            label: 'Minimum Salary (€)',
            min: 0,
          },
          {
            name: 'salary_max',
            type: 'number',
            label: 'Maximum Salary (€)',
            min: 0,
          },
          {
            name: 'salary_period',
            type: 'select',
            label: 'Salary Period',
            options: [
              { value: 'hour', label: 'Per Hour' },
              { value: 'month', label: 'Per Month' },
              { value: 'year', label: 'Per Year' },
            ],
          },
          {
            name: 'salary_type',
            type: 'select',
            label: 'Salary Type',
            options: [
              { value: 'gross', label: 'Gross' },
              { value: 'net', label: 'Net' },
            ],
          },
        ],
      },
      {
        name: 'requirements',
        label: 'Requirements',
        fields: [
          {
            name: 'experience_years_min',
            type: 'number',
            label: 'Minimum Experience (years)',
            min: 0,
            max: 50,
          },
          {
            name: 'education_level',
            type: 'select',
            label: 'Education Level',
            options: [
              { value: 'none', label: 'No Requirement' },
              { value: 'high_school', label: 'High School' },
              { value: 'bachelor', label: 'Bachelor' },
              { value: 'master', label: 'Master' },
              { value: 'phd', label: 'PhD' },
            ],
          },
          {
            name: 'languages_required',
            type: 'multiselect',
            label: 'Required Languages',
            options: [
              { value: 'nl', label: 'Dutch' },
              { value: 'fr', label: 'French' },
              { value: 'en', label: 'English' },
              { value: 'de', label: 'German' },
            ],
          },
        ],
      },
      {
        name: 'application',
        label: 'Application Details',
        fields: [
          {
            name: 'application_deadline',
            type: 'date',
            label: 'Application Deadline',
          },
          {
            name: 'start_date',
            type: 'date',
            label: 'Expected Start Date',
          },
          {
            name: 'contact_email',
            type: 'text',
            label: 'Contact Email',
            validation: '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$',
          },
        ],
      },
    ],
  };
}

/**
 * Main route handler
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categorySlug = searchParams.get('category');
    const lang = searchParams.get('lang') || 'en';
    
    if (!categorySlug) {
      return NextResponse.json(
        { error: 'category parameter is required' },
        { status: 400 }
      );
    }
    
    // Get category type
    const categoryType = getCategoryType(categorySlug);
    
    if (!categoryType) {
      return NextResponse.json(
        { error: 'Unknown category' },
        { status: 404 }
      );
    }
    
    // Return appropriate field definitions based on category type
    let fields: CategoryFieldsResponse;
    
    switch (categoryType) {
      case 'property':
        fields = getRealEstateFields(lang);
        break;
      case 'job':
        fields = getJobFields(lang);
        break;
      case 'electronics':
        fields = getElectronicsFields(lang);
        break;
      // Add other categories as needed
      default:
        return NextResponse.json(
          { error: 'Field definitions not yet implemented for this category' },
          { status: 501 }
        );
    }
    
    return NextResponse.json(fields);
  } catch (error) {
    console.error('Catalog fields API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

