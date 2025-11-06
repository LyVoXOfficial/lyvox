/**
 * Pets Validation Schema
 */

import { z } from 'zod';

export const petCategorySchema = z.enum([
  'dog',
  'cat',
  'bird',
  'fish',
  'rodent',
  'reptile',
  'other',
]);

export const petListingTypeSchema = z.enum(['sale', 'adoption', 'lost', 'found']);

export const petGenderSchema = z.enum(['male', 'female', 'unknown']);

export const petsSchema = z.object({
  // Classification
  category: petCategorySchema,
  listing_type: petListingTypeSchema,
  species: z.string().max(100).optional(),
  breed: z.string().max(100).optional(),
  
  // Details
  age_years: z.number().int().nonnegative().max(50).optional(),
  age_months: z.number().int().nonnegative().max(11).optional(),
  gender: petGenderSchema.optional(),
  
  // Legal (Belgium requirements)
  microchipped: z.boolean().optional(),
  microchip_number: z.string().max(20).optional(), // HIDDEN publicly
  vaccinated: z.boolean().optional(),
  vaccination_card: z.boolean().optional(),
  pet_passport: z.boolean().optional(),
  registered: z.boolean().optional(), // With Belgian authorities
  
  // Health
  neutered_spayed: z.boolean().optional(),
  health_issues: z.string().max(1000).optional(),
  temperament: z.string().max(1000).optional(),
  
  // For adoption
  adoption_fee: z.number().nonnegative().optional(),
  good_with_kids: z.boolean().optional(),
  good_with_dogs: z.boolean().optional(),
  good_with_cats: z.boolean().optional(),
  
  // For lost/found
  last_seen_date: z.string().date().optional(),
  last_seen_location: z.string().max(500).optional(),
  distinctive_marks: z.string().max(500).optional(),
})
.refine(
  (data) => {
    // Dogs and cats MUST be microchipped in Belgium (if for sale/adoption)
    if ((data.category === 'dog' || data.category === 'cat') && 
        (data.listing_type === 'sale' || data.listing_type === 'adoption')) {
      return data.microchipped === true;
    }
    return true;
  },
  { message: 'Dogs and cats must be microchipped in Belgium', path: ['microchipped'] }
)
.refine(
  (data) => {
    // Lost/found pets should have last_seen details
    if (data.listing_type === 'lost' || data.listing_type === 'found') {
      return data.last_seen_date && data.last_seen_location;
    }
    return true;
  },
  { message: 'Last seen date and location are required for lost/found pets', path: ['last_seen_date'] }
)
.refine(
  (data) => {
    // Adoption listings should have temperament info
    if (data.listing_type === 'adoption') {
      return !!data.temperament;
    }
    return true;
  },
  { message: 'Temperament information is required for adoption listings', path: ['temperament'] }
);

export type PetsInput = z.infer<typeof petsSchema>;

