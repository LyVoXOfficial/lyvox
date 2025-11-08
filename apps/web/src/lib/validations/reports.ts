import { z } from "zod";

/**
 * Schema for creating a report (POST /api/reports/create)
 */
export const createReportSchema = z.object({
  advert_id: z
    .string()
    .uuid("Advert ID must be a valid UUID"),
  
  reason: z
    .string()
    .trim()
    .min(1, "Reason is required")
    .max(500, "Reason must not exceed 500 characters"),
  
  details: z
    .string()
    .trim()
    .max(2000, "Details must not exceed 2000 characters")
    .nullable()
    .optional(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

/**
 * Schema for updating a report (admin only) (POST /api/reports/update)
 */
export const updateReportSchema = z.object({
  id: z
    .number()
    .int("Report ID must be an integer")
    .positive("Report ID must be positive"),
  
  new_status: z.enum(["accepted", "rejected"]),
  
  unpublish: z
    .boolean()
    .optional(),
});

export type UpdateReportInput = z.infer<typeof updateReportSchema>;

