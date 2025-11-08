import { z } from "zod";

/**
 * Schema for updating an advert (PATCH /api/adverts/[id])
 */
export const updateAdvertSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Title must be at least 3 characters")
      .max(200, "Title must not exceed 200 characters")
      .optional(),
    
    description: z
      .string()
      .trim()
      .max(10000, "Description must not exceed 10000 characters")
      .optional(),
    
    price: z
      .number()
      .nonnegative("Price must be non-negative")
      .finite("Price must be a valid number")
      .nullable()
      .optional(),
    
    currency: z.enum(["EUR", "USD", "GBP", "RUB"]).optional(),
    
    condition: z.enum(["new", "used", "for_parts"]).optional(),
    
    location: z
      .string()
      .trim()
      .max(200, "Location must not exceed 200 characters")
      .nullable()
      .optional(),
    
    category_id: z
      .string()
      .uuid("Category ID must be a valid UUID")
      .optional(),
    
    status: z.enum(["draft", "active", "archived"]).optional(),
    
    specifics: z
      .record(z.string(), z.string())
      .nullable()
      .optional(),
  })
  .refine(
    (data) => {
      // If status is being set to "active", description must be at least 10 characters
      if (data.status === "active" && data.description !== undefined) {
        return data.description === null || data.description.length >= 10;
      }
      return true;
    },
    {
      message: "Description must be at least 10 characters when publishing (status: active)",
      path: ["description"],
    },
  );

export type UpdateAdvertInput = z.infer<typeof updateAdvertSchema>;

