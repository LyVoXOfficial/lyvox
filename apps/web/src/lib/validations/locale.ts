import { z } from "zod";

/**
 * Schema for POST /api/locale.
 */
export const setLocaleSchema = z.object({
  locale: z.string().min(2).max(10),
});

export type SetLocaleInput = z.infer<typeof setLocaleSchema>;
