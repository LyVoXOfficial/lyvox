import { z } from "zod";

/**
 * Schema for creating a checkout session (POST /api/billing/checkout)
 */
export const createCheckoutSchema = z.object({
  product_code: z
    .string()
    .trim()
    .min(1, "Product code is required"),
  
  advert_id: z
    .string()
    .uuid("Advert ID must be a valid UUID")
    .optional(),
});

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;

