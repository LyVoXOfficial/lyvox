/**
 * Fashion Validation Schema
 */

import { z } from 'zod';

export const genderSchema = z.enum(['women', 'men', 'unisex']);

export const ageCategorySchema = z.enum(['baby', 'toddler', 'kids', 'teens', 'adults']);

export const clothingTypeSchema = z.enum([
  'dress',
  'shirt',
  'blouse',
  't_shirt',
  'sweater',
  'jacket',
  'coat',
  'pants',
  'jeans',
  'skirt',
  'shorts',
  'suit',
  'shoes',
  'boots',
  'sneakers',
  'bag',
  'accessory',
  'underwear',
  'swimwear',
  'sportswear',
]);

export const seasonSchema = z.enum(['spring_summer', 'autumn_winter', 'all_season']);

export const conditionSchema = z.enum(['new', 'like_new', 'good', 'fair', 'for_parts']);

export const deliveryOptionSchema = z.enum([
  'pickup_only',
  'delivery_available',
  'shipping_national',
  'shipping_international',
]);

export const fashionSchema = z.object({
  // Classification
  gender: genderSchema.optional(),
  age_category: ageCategorySchema.optional(),
  clothing_type: clothingTypeSchema,
  
  // Sizing (Belgium/EU standards)
  size_eu: z.string().max(20).optional(),
  size_be: z.string().max(20).optional(),
  size_uk: z.string().max(20).optional(),
  size_us: z.string().max(20).optional(),
  size_label: z.string().max(20).optional(), // XS, S, M, L, XL, etc.
  
  // Measurements (cm)
  height_cm: z.number().int().positive().max(250).optional(),
  chest_bust_cm: z.number().positive().max(200).optional(),
  waist_cm: z.number().positive().max(200).optional(),
  hips_cm: z.number().positive().max(200).optional(),
  inseam_cm: z.number().positive().max(150).optional(),
  
  // Details
  brand: z.string().max(100).optional(),
  color: z.string().min(1, 'Color is required').max(100),
  material: z.string().max(200).optional(),
  pattern: z.string().max(100).optional(),
  season: seasonSchema.optional(),
  
  // Condition
  condition: conditionSchema,
  defects: z.string().max(500).optional(),
  
  // Care
  washing_instructions: z.string().max(500).optional(),
  
  // Provenance
  original_tags: z.boolean().optional(),
  designer: z.boolean().optional(),
  vintage: z.boolean().optional(),
  vintage_decade: z.string().max(20).optional(), // '1950s', '1960s', etc.
  
  // Delivery
  delivery_options: z.array(deliveryOptionSchema).optional(),
})
.refine(
  (data) => {
    // At least one size field should be provided
    return data.size_eu || data.size_be || data.size_uk || data.size_us || data.size_label;
  },
  { message: 'At least one size specification is required', path: ['size_label'] }
)
.refine(
  (data) => {
    // If vintage, decade should be provided
    if (data.vintage) {
      return !!data.vintage_decade;
    }
    return true;
  },
  { message: 'Vintage decade is required for vintage items', path: ['vintage_decade'] }
);

export type FashionInput = z.infer<typeof fashionSchema>;

