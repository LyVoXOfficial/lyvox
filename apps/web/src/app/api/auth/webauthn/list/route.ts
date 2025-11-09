/**
 * GET /api/auth/webauthn/list
 * 
 * Возвращает список всех зарегистрированных биометрических ключей
 * 
 * @example
 * GET /api/auth/webauthn/list
 * Response: { ok: true, data: { credentials: [...] } }
 */

import { supabaseServer } from "@/lib/supabaseServer";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/lib/apiErrors";
import type { WebAuthnListResponse } from "@/types/webauthn";
import type { BiometricCredential } from "@/lib/webauthn";

export const runtime = "nodejs";

// ============================================================================
// GET Handler
// ============================================================================

export async function GET() {
  try {
    // 1. Проверка авторизации
    const supabase = await supabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return createErrorResponse(ApiErrorCode.UNAUTHENTICATED, {
        status: 401,
        detail: "You must be logged in to list biometric keys",
      });
    }

    // 2. Получаем список всех MFA факторов
    const { data: factorsData, error: listError } = await supabase.auth.mfa.listFactors();

    if (listError) {
      return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, {
        status: 500,
        detail: `Failed to list factors: ${listError.message}`,
      });
    }

    // 3. Фильтруем только WebAuthn факторы
    const allFactors = factorsData?.all || [];
    const webAuthnFactors = allFactors.filter((factor) => factor.factor_type === "webauthn");

    // 4. Преобразуем в наш формат BiometricCredential
    const credentials: BiometricCredential[] = webAuthnFactors.map((factor) => ({
      id: factor.id,
      factorId: factor.id,
      friendlyName: factor.friendly_name || "Biometric Key",
      createdAt: factor.created_at,
      lastUsedAt: factor.updated_at,
      factorType: "webauthn",
    }));

    // 5. Успешный ответ
    const response: WebAuthnListResponse = {
      ok: true,
      data: {
        credentials,
      },
    };

    return createSuccessResponse(response.data, 200);
  } catch (error) {
    console.error("[WebAuthn List] Unexpected error:", error);
    return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, {
      status: 500,
      detail: error instanceof Error ? error.message : "Unknown error",
    });
  }
}






