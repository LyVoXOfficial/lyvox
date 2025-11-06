/**
 * Services Validation Schema
 */

import { z } from 'zod';

export const serviceCategorySchema = z.enum([
  'home_services',
  'beauty_wellness',
  'education_tutoring',
  'it_tech',
  'events',
  'transport_moving',
  'professional',
  'other',
]);

export const locationServiceSchema = z.enum([
  'client_location',
  'provider_location',
  'remote',
  'flexible',
]);

export const dayOfWeekSchema = z.enum([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);

// Belgium VAT number format
const belgianVatSchema = z.string().regex(/^(BE)?0?[0-9]{10}$/, {
  message: 'Invalid Belgian VAT number format',
});

export const servicesSchema = z.object({
  service_category: serviceCategorySchema,
  service_type: z.string().min(1, 'Service type is required').max(200),
  
  // Pricing
  price_per_hour: z.number().positive().optional(),
  price_per_session: z.number().positive().optional(),
  price_negotiable: z.boolean().default(false),
  
  // Provider
  provider_certified: z.boolean().optional(),
  certifications: z.array(z.string()).optional(),
  experience_years: z.number().int().nonnegative().max(70).optional(),
  
  // Legal (Belgium)
  vat_registered: z.boolean().optional(),
  vat_number: belgianVatSchema.optional(),
  insurance: z.boolean().optional(),
  
  // Availability
  available_days: z.array(dayOfWeekSchema).optional(),
  available_hours: z.string().max(100).optional(), // '9:00-17:00'
  
  location_service: locationServiceSchema.optional(),
})
.refine(
  (data) => {
    // At least one pricing option should be provided
    return data.price_per_hour || data.price_per_session || data.price_negotiable;
  },
  { message: 'At least one pricing option is required', path: ['price_per_hour'] }
)
.refine(
  (data) => {
    // If VAT registered, VAT number is required
    if (data.vat_registered) {
      return !!data.vat_number;
    }
    return true;
  },
  { message: 'VAT number is required for VAT-registered businesses', path: ['vat_number'] }
)
.refine(
  (data) => {
    // Professional services should have insurance
    if (data.service_category === 'professional') {
      return data.insurance === true;
    }
    return true;
  },
  { message: 'Professional services should have insurance', path: ['insurance'] }
);

export type ServicesInput = z.infer<typeof servicesSchema>;

