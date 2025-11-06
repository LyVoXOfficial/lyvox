/**
 * Electronics Validation Schema
 */

import { z } from 'zod';

export const deviceTypeSchema = z.enum([
  'phone',
  'tablet',
  'laptop',
  'desktop',
  'camera',
  'tv',
  'audio',
  'console',
  'watch',
  'monitor',
  'printer',
  'other',
]);

export const batteryConditionSchema = z.enum([
  'excellent',
  'good',
  'average',
  'poor',
  'needs_replacement',
]);

export const conditionSchema = z.enum(['new', 'like_new', 'good', 'fair', 'for_parts']);

export const deliveryOptionSchema = z.enum([
  'pickup_only',
  'delivery_available',
  'shipping_national',
  'shipping_international',
]);

// IMEI validation (15 digits)
const imeiSchema = z.string().regex(/^[0-9]{15}$/, {
  message: 'IMEI must be exactly 15 digits',
});

export const electronicsSchema = z.object({
  // Device Info
  device_type: deviceTypeSchema,
  brand: z.string().min(1, 'Brand is required').max(100),
  model: z.string().min(1, 'Model is required').max(200),
  release_year: z.number().int().min(2000).max(new Date().getFullYear() + 1).optional(),
  
  // Technical Specs
  memory_gb: z.number().positive().max(1024).optional(), // RAM
  storage_gb: z.number().positive().max(16384).optional(), // Storage (16TB max)
  processor: z.string().max(200).optional(),
  graphics_card: z.string().max(200).optional(),
  screen_size_inch: z.number().positive().max(150).optional(),
  resolution: z.string().max(50).optional(), // e.g., '1920x1080', '4K'
  
  // Condition
  condition: conditionSchema,
  battery_condition: batteryConditionSchema.optional(),
  hours_of_use: z.number().int().nonnegative().optional(),
  
  // Status
  factory_locked: z.boolean().optional(),
  icloud_locked: z.boolean().optional(),
  activation_lock: z.boolean().optional(),
  sim_lock_carrier: z.string().max(100).optional(),
  
  // Completeness
  original_box: z.boolean().optional(),
  original_charger: z.boolean().optional(),
  accessories_included: z.array(z.string()).optional(),
  
  // Documentation & Warranty
  purchase_receipt: z.boolean().optional(),
  warranty_until: z.string().date().optional(),
  manufacturer_warranty: z.boolean().optional(),
  
  // Hidden fields (not shown publicly)
  imei: imeiSchema.optional(),
  serial_number: z.string().max(100).optional(),
  
  // Delivery
  delivery_options: z.array(deliveryOptionSchema).optional(),
})
.refine(
  (data) => {
    // Phones and tablets should have IMEI if condition is not for_parts
    if ((data.device_type === 'phone' || data.device_type === 'tablet') && 
        data.condition !== 'for_parts') {
      return true; // IMEI is optional but recommended
    }
    return true;
  },
  { message: 'IMEI recommended for phones/tablets in working condition', path: ['imei'] }
)
.refine(
  (data) => {
    // Battery condition should be provided for devices with batteries
    if (['phone', 'tablet', 'laptop', 'watch'].includes(data.device_type) && 
        data.condition !== 'for_parts') {
      return !!data.battery_condition;
    }
    return true;
  },
  { message: 'Battery condition is required for this device type', path: ['battery_condition'] }
);

export type ElectronicsInput = z.infer<typeof electronicsSchema>;

