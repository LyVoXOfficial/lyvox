import { z } from "zod";

/**
 * Schema for query parameters when fetching user's adverts
 */
export const getUserAdvertsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
  status: z.enum(["all", "active", "draft", "archived"]).optional().default("all"),
});

/**
 * Schema for updating profile display name
 */
export const updateProfileSchema = z.object({
  display_name: z.string().trim().min(1).max(100).optional(),
});

/**
 * Schema for updating user consents
 */
export const updateConsentsSchema = z.object({
  marketingOptIn: z.boolean().optional(),
});
