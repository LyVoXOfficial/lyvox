import { z } from "zod";

/**
 * Email validation pattern
 */
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Password validation: at least 8 characters, 3 of 4 character classes
 * (uppercase, lowercase, number, symbol)
 */
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$|^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$|^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$|^(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$|^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

/**
 * Schema for email login (POST /api/auth/login or OTP)
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Пожалуйста, введите ваш email")
    .regex(emailPattern, "Введите корректный email адрес (например: user@example.com)"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Schema for user registration (POST /api/auth/register)
 */
export const registerSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Пожалуйста, введите email")
      .regex(emailPattern, "Введите корректный email адрес (например: user@example.com)"),
    
    password: z
      .string()
      .min(8, "Пароль должен содержать минимум 8 символов")
      .regex(
        passwordRegex,
        "Пароль должен содержать минимум 3 из: заглавные буквы, строчные буквы, цифры, символы",
      ),
    
    confirmPassword: z.string().min(1, "Пожалуйста, подтвердите пароль"),
    
    consents: z
      .object({
        terms: z.boolean(),
        privacy: z.boolean(),
        marketing: z.boolean().optional(),
      })
      .refine((data) => data.terms === true, {
        message: "Необходимо принять условия использования",
        path: ["terms"],
      })
      .refine((data) => data.privacy === true, {
        message: "Необходимо принять политику конфиденциальности",
        path: ["privacy"],
      }),
    
    locale: z
      .string()
      .regex(/^(en|nl|fr|ru|de)$/i, "Язык должен быть одним из: en, nl, fr, ru, de")
      .optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

