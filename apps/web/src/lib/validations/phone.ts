import { z } from "zod";

/**
 * E.164 phone number pattern: + followed by 8-15 digits
 */
const e164Pattern = /^\+\d{8,15}$/;

/**
 * Schema for requesting an OTP (POST /api/phone/request)
 */
export const requestOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(e164Pattern, "Phone must be in E.164 format (e.g., +32470123456)"),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

/**
 * Schema for verifying an OTP (POST /api/phone/verify)
 */
export const verifyOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(e164Pattern, "Phone must be in E.164 format (e.g., +32470123456)"),
  
  code: z
    .string()
    .trim()
    .min(1, "OTP code is required")
    .max(10, "OTP code must not exceed 10 characters"),
});

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

