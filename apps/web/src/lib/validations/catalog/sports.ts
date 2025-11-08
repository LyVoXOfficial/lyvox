/**
 * Sports & Hobbies Validation Schema
 */

import { z } from 'zod';

export const sportTypeSchema = z.enum([
  'cycling',
  'fitness',
  'running',
  'swimming',
  'team_sports',
  'winter_sports',
  'water_sports',
  'outdoor',
  'combat_sports',
  'racket_sports',
  'other',
]);

const conditionSchema = z.enum(['new', 'like_new', 'good', 'fair', 'for_parts']);

const deliveryOptionSchema = z.enum([
  'pickup_only',
  'delivery_available',
  'shipping_national',
  'shipping_international',
]);

export const sportsSchema = z.object({
  sport_type: sportTypeSchema,
  item_type: z.string().min(1, 'Item type is required').max(100),
  brand: z.string().max(100).optional(),
  size: z.string().max(50).optional(),
  
  condition: conditionSchema,
  
  // Bike-specific
  frame_size_cm: z.number().int().positive().max(100).optional(),
  wheel_size_inch: z.number().positive().max(36).optional(),
  gears: z.number().int().nonnegative().max(30).optional(),
  
  delivery_options: z.array(deliveryOptionSchema).optional(),
})
.refine(
  (data) => {
    // Bicycles should have frame size
    if (data.sport_type === 'cycling' && data.item_type.toLowerCase().includes('bicy')) {
      return !!data.frame_size_cm;
    }
    return true;
  },
  { message: 'Frame size is required for bicycles', path: ['frame_size_cm'] }
);

export type SportsInput = z.infer<typeof sportsSchema>;

