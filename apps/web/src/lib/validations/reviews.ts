import { z } from "zod";

/**
 * Schema for creating a review (POST /api/reviews)
 */
export const createReviewSchema = z.object({
  advert_id: z.string().uuid("advert_id must be a valid UUID"),
  rating: z
    .number()
    .int("rating must be an integer")
    .min(1, "rating must be at least 1")
    .max(5, "rating must be at most 5"),
  comment: z
    .string()
    .max(1000, "comment must not exceed 1000 characters")
    .optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
