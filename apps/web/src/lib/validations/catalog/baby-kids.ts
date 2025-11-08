/**
 * Baby & Kids Validation Schema
 */

import { z } from 'zod';

export const babyItemTypeSchema = z.enum([
  'stroller',
  'car_seat',
  'crib',
  'high_chair',
  'baby_carrier',
  'playpen',
  'toy',
  'clothing',
  'books',
  'gear',
]);

const conditionSchema = z.enum(['new', 'like_new', 'good', 'fair', 'for_parts']);

const deliveryOptionSchema = z.enum([
  'pickup_only',
  'delivery_available',
  'shipping_national',
  'shipping_international',
]);

export const babyKidsSchema = z.object({
  item_type: babyItemTypeSchema,
  age_range: z.string().max(100).optional(), // '0-6 months', '6-12 months', etc.
  brand: z.string().max(100).optional(),
  
  // Safety (CRITICAL)
  safety_standards: z.array(z.string()).optional(), // ['EN71', 'CE', etc.]
  safety_cert_url: z.string().url().optional(),
  recall_status: z.enum(['safe', 'recalled', 'unknown']).default('unknown'),
  
  condition: conditionSchema,
  
  // Hygiene
  cleanable: z.boolean().optional(),
  washable: z.boolean().optional(),
  sterilized: z.boolean().optional(),
  
  delivery_options: z.array(deliveryOptionSchema).optional(),
})
.refine(
  (data) => {
    // Safety-critical items MUST have safety standards
    const safetyCriticalTypes = ['car_seat', 'crib', 'high_chair', 'baby_carrier', 'playpen'];
    if (safetyCriticalTypes.includes(data.item_type)) {
      return data.safety_standards && data.safety_standards.length > 0;
    }
    return true;
  },
  { message: 'Safety standards are required for this item type', path: ['safety_standards'] }
)
.refine(
  (data) => {
    // Recalled items should not be sold
    return data.recall_status !== 'recalled';
  },
  { message: 'Recalled items cannot be listed', path: ['recall_status'] }
);

export type BabyKidsInput = z.infer<typeof babyKidsSchema>;

