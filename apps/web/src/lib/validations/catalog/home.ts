/**
 * Home & Living Validation Schema
 */

import { z } from 'zod';

export const furnitureTypeSchema = z.enum([
  'sofa',
  'chair',
  'table',
  'bed',
  'wardrobe',
  'shelf',
  'desk',
  'cabinet',
  'decoration',
  'lighting',
  'kitchen',
  'appliance',
]);

export const conditionSchema = z.enum(['new', 'like_new', 'good', 'fair', 'for_parts']);

export const deliveryOptionSchema = z.enum([
  'pickup_only',
  'delivery_available',
  'shipping_national',
  'shipping_international',
]);

export const homeSchema = z.object({
  furniture_type: furnitureTypeSchema,
  brand: z.string().max(100).optional(),
  material: z.string().max(200).optional(),
  color: z.string().max(100).optional(),
  
  // Dimensions (cm)
  width_cm: z.number().positive().max(1000).optional(),
  height_cm: z.number().positive().max(1000).optional(),
  depth_cm: z.number().positive().max(1000).optional(),
  
  condition: conditionSchema,
  assembly_required: z.boolean().optional(),
  
  delivery_options: z.array(deliveryOptionSchema).optional(),
})
.refine(
  (data) => {
    // For furniture, dimensions are recommended
    if (['sofa', 'chair', 'table', 'bed', 'wardrobe', 'shelf', 'desk', 'cabinet'].includes(data.furniture_type)) {
      return data.width_cm || data.height_cm || data.depth_cm;
    }
    return true;
  },
  { message: 'Dimensions are recommended for furniture items', path: ['width_cm'] }
);

export type HomeInput = z.infer<typeof homeSchema>;

