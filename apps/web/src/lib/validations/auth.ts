import { z } from "zod";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$|^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$|^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$|^(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$|^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter your email address.")
    .regex(emailPattern, "Enter a valid email address, for example user@example.com."),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Enter your email address.")
      .regex(emailPattern, "Enter a valid email address, for example user@example.com."),

    password: z
      .string()
      .min(8, "Password must contain at least 8 characters.")
      .regex(
        passwordRegex,
        "Password must include at least 3 of: uppercase letters, lowercase letters, numbers, symbols.",
      ),

    confirmPassword: z.string().min(1, "Confirm your password."),

    consents: z
      .object({
        terms: z.boolean(),
        privacy: z.boolean(),
        marketing: z.boolean().optional(),
      })
      .refine((data) => data.terms === true, {
        message: "Accept the Terms of Service to continue.",
        path: ["terms"],
      })
      .refine((data) => data.privacy === true, {
        message: "Accept the Privacy Policy to continue.",
        path: ["privacy"],
      }),

    locale: z
      .string()
      .regex(/^(en|nl|fr|ru|de)$/i, "Language must be one of: en, nl, fr, ru, de.")
      .optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
