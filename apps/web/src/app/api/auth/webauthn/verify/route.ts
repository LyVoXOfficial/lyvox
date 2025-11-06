/**
 * POST /api/auth/webauthn/verify
 * 
 * Верифицирует пользователя через биометрию
 * 
 * @example
 * POST /api/auth/webauthn/verify
 * Body: { factorId: "..." }
 * Response: { ok: true, data: { verified: true } }
 */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/lib/apiErrors";
import type { WebAuthnVerifyRequest, WebAuthnVerifyResponse } from "@/types/webauthn";
import { z } from "zod";

export const runtime = "nodejs";

// ============================================================================
// Validation Schema
// ============================================================================

const verifySchema = z.object({
  factorId: z
    .string()
    .uuid("Invalid factor ID format")
    .optional(),
});

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: Request) {
  try {
    // 1. Парсинг request body
    let body: WebAuthnVerifyRequest;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse(ApiErrorCode.INVALID_JSON, {
        status: 400,
        detail: "Invalid JSON in request body",
      });
    }

    // 2. Валидация входных данных
    const validation = verifySchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(ApiErrorCode.BAD_INPUT, {
        status: 400,
        detail: validation.error.errors[0].message,
      });
    }

    const { factorId } = validation.data;

    // 3. Проверка авторизации
    const supabase = supabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return createErrorResponse(ApiErrorCode.UNAUTHENTICATED, {
        status: 401,
        detail: "You must be logged in to verify biometric authentication",
      });
    }

    // 4. Получаем список факторов, если factorId не указан
    let targetFactorId = factorId;
    if (!targetFactorId) {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      
      if (listError) {
        return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, {
          status: 500,
          detail: `Failed to list factors: ${listError.message}`,
        });
      }

      const webAuthnFactors = factors?.all?.filter((f) => f.factor_type === "webauthn");
      if (!webAuthnFactors || webAuthnFactors.length === 0) {
        return createErrorResponse(ApiErrorCode.NOT_FOUND, {
          status: 404,
          detail: "No biometric keys registered",
        });
      }

      targetFactorId = webAuthnFactors[0].id;
    }

    // 5. Создаем challenge для верификации
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: targetFactorId,
    });

    if (challengeError) {
      return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, {
        status: 500,
        detail: `Challenge failed: ${challengeError.message}`,
      });
    }

    if (!challengeData || !challengeData.id) {
      return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, {
        status: 500,
        detail: "Challenge failed: No challenge ID returned",
      });
    }

    // 6. Верифицируем с помощью WebAuthn
    const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
      factorId: targetFactorId,
      challengeId: challengeData.id,
    });

    if (verifyError) {
      return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, {
        status: 500,
        detail: `Verification failed: ${verifyError.message}`,
      });
    }

    // 7. Успешный ответ
    const response: WebAuthnVerifyResponse = {
      ok: true,
      data: {
        verified: true,
      },
    };

    return createSuccessResponse(response.data, 200);
  } catch (error) {
    console.error("[WebAuthn Verify] Unexpected error:", error);
    return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, {
      status: 500,
      detail: error instanceof Error ? error.message : "Unknown error",
    });
  }
}




