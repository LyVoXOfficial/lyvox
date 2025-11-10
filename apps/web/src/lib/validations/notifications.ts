import { z } from "zod";

/**
 * Schema for updating notification preferences (POST /api/notifications/preferences)
 */
export const updateNotificationPreferencesSchema = z.object({
  email: z.record(z.string(), z.boolean()).optional(),
  push: z.record(z.string(), z.boolean()).optional(),
  sms: z.record(z.string(), z.boolean()).optional(),
});

export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;

