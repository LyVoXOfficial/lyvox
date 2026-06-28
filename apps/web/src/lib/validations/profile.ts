import { z } from "zod";

/**
 * Schema for query parameters when fetching user's adverts
 */
export const getUserAdvertsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
  status: z.enum(["all", "active", "draft", "archived"]).optional().default("all"),
});

const discoverPrefsSchema = z.object({
  mode: z.enum(["standard", "simple", "buttons"]).optional(),
  haptics: z.boolean().optional(),
  ask_reason_down: z.boolean().optional(),
  confirm_actions: z.boolean().optional(),
});

/**
 * Schema for updating profile display name and discover preferences
 */
export const updateProfileSchema = z.object({
  display_name: z.string().trim().min(1).max(100).optional(),
  discover_prefs: discoverPrefsSchema.optional(),
});

/**
 * Schema for updating user consents
 */
export const updateConsentsSchema = z.object({
  marketingOptIn: z.boolean().optional(),
});
