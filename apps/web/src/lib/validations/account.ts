import { z } from "zod";

/**
 * Schema for POST /api/account/delete (GDPR Art.17 self-erasure).
 * password is optional here because phone-only accounts (no email) skip
 * password re-auth entirely — that business rule is enforced in the route,
 * not the schema.
 */
export const deleteAccountSchema = z.object({
  confirm: z.literal("DELETE"),
  password: z.string().min(1).optional(),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
