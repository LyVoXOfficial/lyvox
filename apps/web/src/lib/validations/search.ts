import { z } from "zod";

/**
 * Schema for search query parameters (GET /api/search)
 * All parameters are optional to allow flexible searching
 */
export const searchAdvertsQuerySchema = z
  .object({
    // Search query text for full-text search
    q: z
      .string()
      .trim()
      .min(1, "Search query must not be empty")
      .max(200, "Search query must not exceed 200 characters")
      .optional()
      .nullable()
      .transform((val) => val || null),

    // Category filter (UUID)
    category_id: z
      .string()
      .uuid("Category ID must be a valid UUID")
      .optional()
      .nullable()
      .transform((val) => val || null),

    // Price range filters
    price_min: z
      .string()
      .optional()
      .nullable()
      .transform((val) => {
        if (!val) return null;
        const parsed = Number.parseFloat(val);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
      }),
    price_max: z
      .string()
      .optional()
      .nullable()
      .transform((val) => {
        if (!val) return null;
        const parsed = Number.parseFloat(val);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
      }),

    // Location filter (text matching)
    location: z
      .string()
      .trim()
      .max(200, "Location must not exceed 200 characters")
      .optional()
      .nullable()
      .transform((val) => val || null),

    // Verified sellers filter
    verified_only: z
      .string()
      .optional()
      .nullable()
      .transform((val) => {
        if (!val) return false;
        const normalized = val.trim().toLowerCase();
        return normalized === "true" || normalized === "1" || normalized === "yes";
      }),

    // Geospatial search coordinates
    lat: z
      .string()
      .optional()
      .nullable()
      .transform((val) => {
        if (!val) return null;
        const parsed = Number.parseFloat(val);
        return Number.isFinite(parsed) && parsed >= -90 && parsed <= 90 ? parsed : null;
      }),
    lng: z
      .string()
      .optional()
      .nullable()
      .transform((val) => {
        if (!val) return null;
        const parsed = Number.parseFloat(val);
        return Number.isFinite(parsed) && parsed >= -180 && parsed <= 180 ? parsed : null;
      }),
    radius_km: z
      .string()
      .optional()
      .nullable()
      .transform((val) => {
        if (!val) return null;
        const parsed = Number.parseFloat(val);
        return Number.isFinite(parsed) && parsed > 0 && parsed <= 1000 ? parsed : 50;
      }),

    // Sort option
    sort_by: z
      .enum(["relevance", "price_asc", "price_desc", "created_at_asc", "created_at_desc"])
      .default("created_at_desc"),

    // Pagination
    page: z
      .string()
      .optional()
      .transform((val) => {
        if (!val) return 0;
        const parsed = Number.parseInt(val, 10);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
      }),
    limit: z
      .string()
      .optional()
      .transform((val) => {
        if (!val) return 24;
        const parsed = Number.parseInt(val, 10);
        return Number.isFinite(parsed) && parsed > 0 && parsed <= 100 ? parsed : 24;
      }),
  })
  .refine(
    (data) => {
      // If price_min is provided, it should be <= price_max (if price_max is provided)
      if (data.price_min !== null && data.price_max !== null) {
        return data.price_min <= data.price_max;
      }
      return true;
    },
    {
      message: "price_min must be less than or equal to price_max",
      path: ["price_min"],
    },
  )
  .refine(
    (data) => {
      // If lat or lng is provided, both must be provided
      if (data.lat !== null || data.lng !== null) {
        return data.lat !== null && data.lng !== null;
      }
      return true;
    },
    {
      message: "Both latitude and longitude must be provided for geospatial search",
      path: ["lat"],
    },
  );

export type SearchAdvertsQuery = z.infer<typeof searchAdvertsQuerySchema>;

