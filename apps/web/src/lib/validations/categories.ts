/**
 * Zod validation schemas for categories API endpoints
 */

import { z } from "zod";
import { supportedLocales } from "@/lib/i18n";

/**
 * Schema for category tree query parameters
 */
export const categoryTreeQuerySchema = z.object({
  locale: z
    .enum(supportedLocales, {
      errorMap: () => ({
        message: `Locale must be one of: ${supportedLocales.join(", ")}`,
      }),
    })
    .optional()
    .default("en"),
});

export type CategoryTreeQuery = z.infer<typeof categoryTreeQuerySchema>;

