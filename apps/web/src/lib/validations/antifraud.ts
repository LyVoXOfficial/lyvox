import { z } from "zod";

/**
 * Schema for POST /api/antifraud/verify-captcha
 */
export const verifyCaptchaSchema = z.object({
  token: z.string().min(1, "Captcha token is required"),
});

export type VerifyCaptchaInput = z.infer<typeof verifyCaptchaSchema>;
