/**
 * Property (Real Estate) Validation Schema
 */

import { z } from 'zod';

export const propertyTypeSchema = z.enum([
  'apartment',
  'house',
  'villa',
  'townhouse',
  'studio',
  'loft',
  'duplex',
  'penthouse',
  'land',
  'commercial',
  'office',
  'garage',
  'parking_space',
  'storage',
]);

export const listingTypeSchema = z.enum(['sale', 'rent']);

export const epcRatingSchema = z.enum(['A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G']);

export const heatingTypeSchema = z.enum([
  'gas',
  'electric',
  'oil',
  'heat_pump',
  'solar',
  'wood',
  'district',
  'none',
]);

export const furnishedTypeSchema = z.enum(['unfurnished', 'semi_furnished', 'fully_furnished']);

export const parkingTypeSchema = z.enum(['garage', 'carport', 'street', 'underground']);

export const gardenOrientationSchema = z.enum(['north', 'south', 'east', 'west']);

// Belgium postcode validation
const belgianPostcodeSchema = z.string().regex(/^[1-9][0-9]{3}$/, {
  message: 'Belgian postcode must be 4 digits (1000-9999)',
});

// EPC certificate format validation
const epcCertNumberSchema = z.string().regex(/^[0-9]{8}-[0-9]{7}-[0-9]{2}$/, {
  message: 'EPC certificate format: YYYYMMDD-NNNNNNN-NN',
});

export const propertyListingSchema = z.object({
  // Classification
  property_type: propertyTypeSchema,
  listing_type: listingTypeSchema,
  
  // Dimensions (REQUIRED)
  area_sqm: z.number().positive().max(10000, 'Area must be less than 10,000 m²'),
  land_area_sqm: z.number().positive().optional(),
  rooms: z.number().int().min(0).max(20).optional(),
  bedrooms: z.number().int().min(0).max(15).optional(),
  bathrooms: z.number().min(0).max(10).optional(),
  
  // Building Info
  year_built: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
  renovation_year: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
  floor: z.number().int().min(-3).max(150).optional(),
  total_floors: z.number().int().positive().optional(),
  
  // Energy & Compliance
  epc_rating: epcRatingSchema.optional(),
  epc_cert_number: epcCertNumberSchema.optional(),
  epc_kwh_per_sqm_year: z.number().int().positive().optional(),
  peb_url: z.string().url().optional(),
  
  // Heating & Utilities
  heating_type: z.array(heatingTypeSchema).optional(),
  water_heater_type: z.enum(['instant', 'tank', 'solar']).optional(),
  double_glazing: z.boolean().optional(),
  
  // Rental-Specific
  rent_monthly: z.number().positive().optional(),
  rent_charges_monthly: z.number().nonnegative().optional(),
  syndic_cost_monthly: z.number().nonnegative().optional(),
  deposit_months: z.number().min(0).max(3, 'Deposit cannot exceed 3 months (Belgium law)').optional(),
  lease_duration_months: z.number().int().min(1).max(120).optional(),
  available_from: z.string().date().optional(),
  furnished: furnishedTypeSchema.optional(),
  
  // Location Details
  postcode: belgianPostcodeSchema,
  municipality: z.string().min(1).max(100),
  neighborhood: z.string().max(100).optional(),
  
  // Parking
  parking_spaces: z.number().int().min(0).max(10).default(0),
  parking_type: z.array(parkingTypeSchema).optional(),
  
  // Outdoor Space
  terrace_sqm: z.number().positive().optional(),
  garden_sqm: z.number().positive().optional(),
  garden_orientation: gardenOrientationSchema.optional(),
  
  // Building Features
  elevator: z.boolean().optional(),
  cellar: z.boolean().optional(),
  attic: z.boolean().optional(),
  
  // Policies
  pet_friendly: z.boolean().optional(),
  smoking_allowed: z.boolean().optional(),
})
.refine(
  (data) => !data.bedrooms || !data.rooms || data.bedrooms <= data.rooms,
  { message: 'Bedrooms cannot exceed total rooms', path: ['bedrooms'] }
)
.refine(
  (data) => !data.renovation_year || !data.year_built || data.renovation_year >= data.year_built,
  { message: 'Renovation year must be after build year', path: ['renovation_year'] }
)
.refine(
  (data) => {
    if (data.listing_type === 'rent') {
      return !!data.rent_monthly;
    }
    return true;
  },
  { message: 'Monthly rent is required for rental listings', path: ['rent_monthly'] }
)
.refine(
  (data) => {
    if (data.listing_type === 'sale') {
      return !data.rent_monthly;
    }
    return true;
  },
  { message: 'Monthly rent should not be set for sale listings', path: ['rent_monthly'] }
);

export type PropertyListingInput = z.infer<typeof propertyListingSchema>;

