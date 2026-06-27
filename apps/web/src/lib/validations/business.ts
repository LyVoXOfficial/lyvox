import { z } from "zod";
import { isValidKbo, isValidBelgianVat } from "@/lib/verification/kbo";

/**
 * Zod schema for POST /api/business — create business body.
 * Mirrors the B0 offline format checks from spec §3.3.
 * Cross-field: when vat_liable===true, vat_number is required and must pass isValidBelgianVat.
 */
export const createBusinessSchema = z
  .object({
    legal_name: z.string().trim().min(1).max(200),
    trade_name: z.string().trim().max(200).optional(),
    legal_form: z.string().trim().max(100).optional(),
    kbo_number: z
      .string()
      .trim()
      .refine((v) => isValidKbo(v), { message: "Invalid KBO number (MOD 97-10 check failed)" }),
    vat_number: z.string().trim().optional(),
    vat_liable: z.boolean(),
    address_line: z.string().trim().min(1).max(300),
    postcode: z
      .string()
      .trim()
      .regex(/^[1-9]\d{3}$/, { message: "Belgian postcode must be 4 digits starting with 1-9" }),
    city: z.string().trim().min(1).max(100),
    country: z.string().trim().length(2).default("BE"),
    email: z.string().trim().email(),
    phone_e164: z.string().trim().optional(),
    withdrawal_terms: z.string().trim().min(1).max(2000),
    returns_url: z.string().url().max(500).optional().or(z.literal("")),
    self_certified: z.literal(true),
  })
  .superRefine((data, ctx) => {
    if (data.vat_liable) {
      if (!data.vat_number) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "vat_number is required when vat_liable is true",
          path: ["vat_number"],
        });
      } else if (!isValidBelgianVat(data.vat_number)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid Belgian VAT number (MOD 97-10 check failed)",
          path: ["vat_number"],
        });
      }
    }
  });

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;

/**
 * Zod schema for PATCH /api/business/[id] — owner edits trader fields.
 * ALL fields optional (partial update).
 * Locked identity/verification fields (legal_name, kbo_number, vat_number,
 * vat_liable, status, entity_verified, created_by) are intentionally absent —
 * zod strips unknown keys by default, so sending them is a no-op.
 */
export const updateBusinessSchema = z.object({
  trade_name: z.string().trim().max(200).optional(),
  legal_form: z.string().trim().max(100).optional(),
  address_line: z.string().trim().min(1).max(300).optional(),
  postcode: z
    .string()
    .trim()
    .regex(/^[1-9]\d{3}$/, { message: "Belgian postcode must be 4 digits starting with 1-9" })
    .optional(),
  city: z.string().trim().min(1).max(100).optional(),
  country: z.string().trim().length(2).optional(),
  email: z.string().trim().email().optional(),
  phone_e164: z.string().trim().optional(),
  withdrawal_terms: z.string().trim().max(2000).optional(),
  returns_url: z.string().url().max(500).optional().or(z.literal("")),
});

export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
