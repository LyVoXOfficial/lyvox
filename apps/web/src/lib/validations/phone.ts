import { z } from "zod";

/**
 * Schema for requesting an OTP (POST /api/phone/request)
 *
 * The phone field is accepted as a loose, trimmed string here: national
 * (0470…), 0032… and +32… forms are all valid input. The strict Belgian-mobile
 * validation + canonical E.164 normalization happens in the route handlers via
 * parseBelgianMobile(), which is the single source of truth.
 */
export const requestOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(6, "Phone number too short")
    .max(20, "Phone number too long"),

  turnstileToken: z.string().optional(),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

/**
 * Schema for verifying an OTP (POST /api/phone/verify)
 */
export const verifyOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(6, "Phone number too short")
    .max(20, "Phone number too long"),

  code: z
    .string()
    .trim()
    .min(1, "OTP code is required")
    .max(10, "OTP code must not exceed 10 characters"),

  turnstileToken: z.string().optional(),
});

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

