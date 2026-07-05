import { z } from "zod";

/**
 * Schema for POST /api/moderation/analyze.
 */
export const moderationAnalyzeSchema = z.object({
  advert_id: z.string().uuid("advert_id must be a valid UUID"),
});

export type ModerationAnalyzeInput = z.infer<typeof moderationAnalyzeSchema>;

/**
 * Schema for POST /api/moderation/review.
 */
export const moderationReviewSchema = z.object({
  advert_id: z.string().uuid("advert_id must be a valid UUID"),
  action: z.enum(["approve", "reject", "flag"]),
  reason: z.string().max(1000).optional(),
});

export type ModerationReviewInput = z.infer<typeof moderationReviewSchema>;
