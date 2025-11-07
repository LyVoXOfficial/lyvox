/**
 * POST /api/auth/webauthn/enroll
 * 
 * Регистрирует новый биометрический ключ для текущего пользователя
 * 
 * @example
 * POST /api/auth/webauthn/enroll
 * Body: { friendlyName: "My iPhone" }
 * Response: { ok: true, data: { factorId: "...", friendlyName: "My iPhone" } }
 */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/lib/apiErrors";
import type { WebAuthnEnrollRequest, WebAuthnEnrollResponse } from "@/types/webauthn";
import { z } from "zod";

export const runtime = "nodejs";

// ============================================================================
// Validation Schema
// ============================================================================

const enrollSchema = z.object({
  friendlyName: z
    .string()
    .min(1, "Friendly name cannot be empty")
    .max(100, "Friendly name too long")
    .optional()
    .default("Biometric Key"),
});

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: Request) {
  try {
    // 1. Парсинг request body
    let body: WebAuthnEnrollRequest;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse(ApiErrorCode.INVALID_JSON, {
        status: 400,
        detail: "Invalid JSON in request body",
      });
    }

    // 2. Валидация входных данных
    const validation = enrollSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(ApiErrorCode.BAD_INPUT, {
        status: 400,
        detail: validation.error.errors[0].message,
      });
    }

    const { friendlyName } = validation.data;

    // 3. Проверка авторизации
    const supabase = supabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return createErrorResponse(ApiErrorCode.UNAUTHENTICATED, {
        status: 401,
        detail: "You must be logged in to enroll biometric authentication",
      });
    }

    // 4. Регистрация WebAuthn фактора через Supabase MFA
    const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "webauthn",
      friendlyName,
    });

    if (enrollError) {
      return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, {
        status: 500,
        detail: `Enrollment failed: ${enrollError.message}`,
      });
    }

    if (!enrollData || !enrollData.id) {
      return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, {
        status: 500,
        detail: "Enrollment failed: No factor ID returned",
      });
    }

    // 5. Успешный ответ
    const response: WebAuthnEnrollResponse = {
      ok: true,
      data: {
        factorId: enrollData.id,
        friendlyName: enrollData.friendly_name || friendlyName,
      },
    };

    return createSuccessResponse(response.data, 201);
  } catch (error) {
    console.error("[WebAuthn Enroll] Unexpected error:", error);
    return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, {
      status: 500,
      detail: error instanceof Error ? error.message : "Unknown error",
    });
  }
}






