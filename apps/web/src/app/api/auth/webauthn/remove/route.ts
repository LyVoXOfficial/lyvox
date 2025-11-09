/**
 * DELETE /api/auth/webauthn/remove
 * 
 * Удаляет зарегистрированный биометрический ключ
 * 
 * @example
 * DELETE /api/auth/webauthn/remove
 * Body: { factorId: "..." }
 * Response: { ok: true, data: { removed: true } }
 */

import { supabaseServer } from "@/lib/supabaseServer";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/lib/apiErrors";
import type { WebAuthnRemoveRequest, WebAuthnRemoveResponse } from "@/types/webauthn";
import { z } from "zod";

export const runtime = "nodejs";

// ============================================================================
// Validation Schema
// ============================================================================

const removeSchema = z.object({
  factorId: z
    .string()
    .uuid("Invalid factor ID format"),
});

// ============================================================================
// DELETE Handler
// ============================================================================

export async function DELETE(request: Request) {
  try {
    // 1. Парсинг request body
    let body: WebAuthnRemoveRequest;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse(ApiErrorCode.INVALID_JSON, {
        status: 400,
        detail: "Invalid JSON in request body",
      });
    }

    // 2. Валидация входных данных
    const validation = removeSchema.safeParse(body);
    if (!validation.success) {
      const firstIssue = validation.error.issues[0];
      return createErrorResponse(ApiErrorCode.BAD_INPUT, {
        status: 400,
        detail: firstIssue?.message ?? "Validation failed",
      });
    }

    const { factorId } = validation.data;

    // 3. Проверка авторизации
    const supabase = await supabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return createErrorResponse(ApiErrorCode.UNAUTHENTICATED, {
        status: 401,
        detail: "You must be logged in to remove biometric keys",
      });
    }

    // 4. Проверяем, что фактор существует и принадлежит пользователю
    const { data: factorsData, error: listError } = await supabase.auth.mfa.listFactors();

    if (listError) {
      return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, {
        status: 500,
        detail: `Failed to list factors: ${listError.message}`,
      });
    }

    const allFactors = factorsData?.all || [];
    const factorExists = allFactors.some((f) => f.id === factorId && f.factor_type === "webauthn");

    if (!factorExists) {
      return createErrorResponse(ApiErrorCode.NOT_FOUND, {
        status: 404,
        detail: "Biometric key not found",
      });
    }

    // 5. Удаляем MFA фактор
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId,
    });

    if (unenrollError) {
      return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, {
        status: 500,
        detail: `Failed to remove biometric key: ${unenrollError.message}`,
      });
    }

    // 6. Успешный ответ
    const response: WebAuthnRemoveResponse = {
      ok: true,
      data: {
        removed: true,
      },
    };

    return createSuccessResponse(response.data, 200);
  } catch (error) {
    console.error("[WebAuthn Remove] Unexpected error:", error);
    return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, {
      status: 500,
      detail: error instanceof Error ? error.message : "Unknown error",
    });
  }
}






