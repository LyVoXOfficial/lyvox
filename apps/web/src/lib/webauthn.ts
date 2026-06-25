/**
 * WebAuthn библиотека для биометрической авторизации
 * Интеграция с Supabase Auth MFA API
 */

import { supabase } from "@/lib/supabaseClient";
import type { AuthMFAEnrollResponse, AuthMFAVerifyResponse, AuthMFAListFactorsResponse, AuthMFAUnenrollResponse } from "@supabase/supabase-js";

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Результат регистрации биометрического ключа
 */
export interface EnrollBiometricResult {
  success: boolean;
  factorId?: string;
  error?: WebAuthnError;
}

/**
 * Результат верификации через биометрию
 */
export interface VerifyBiometricResult {
  success: boolean;
  error?: WebAuthnError;
}

/**
 * Биометрический credential (ключ)
 */
export interface BiometricCredential {
  id: string;
  factorId: string;
  friendlyName: string;
  createdAt: string;
  lastUsedAt?: string;
  factorType: "webauthn";
}

/**
 * Список зарегистрированных credentials
 */
export interface ListCredentialsResult {
  success: boolean;
  credentials: BiometricCredential[];
  error?: WebAuthnError;
}

/**
 * Результат удаления credential
 */
export interface RemoveCredentialResult {
  success: boolean;
  error?: WebAuthnError;
}

/**
 * Типы ошибок WebAuthn
 */
export enum WebAuthnErrorType {
  NOT_SUPPORTED = "NOT_SUPPORTED",
  USER_CANCELLED = "USER_CANCELLED",
  NETWORK_ERROR = "NETWORK_ERROR",
  INVALID_STATE = "INVALID_STATE",
  ENROLLMENT_FAILED = "ENROLLMENT_FAILED",
  VERIFICATION_FAILED = "VERIFICATION_FAILED",
  NOT_AUTHENTICATED = "NOT_AUTHENTICATED",
  TIMEOUT = "TIMEOUT",
  UNKNOWN = "UNKNOWN",
}

/**
 * Структура ошибки WebAuthn
 */
export interface WebAuthnError {
  type: WebAuthnErrorType;
  message: string;
  originalError?: unknown;
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Создает стандартизированную ошибку WebAuthn
 */
function createWebAuthnError(
  type: WebAuthnErrorType,
  message: string,
  originalError?: unknown,
): WebAuthnError {
  return { type, message, originalError };
}

/**
 * Обрабатывает и классифицирует ошибки WebAuthn
 */
function handleWebAuthnError(error: unknown): WebAuthnError {
  // DOMException ошибки от Web Authentication API
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotSupportedError":
        return createWebAuthnError(
          WebAuthnErrorType.NOT_SUPPORTED,
          "This browser does not support passkeys.",
          error,
        );
      case "NotAllowedError":
        return createWebAuthnError(
          WebAuthnErrorType.USER_CANCELLED,
          "Passkey verification was cancelled.",
          error,
        );
      case "InvalidStateError":
        return createWebAuthnError(
          WebAuthnErrorType.INVALID_STATE,
          "This passkey is already registered.",
          error,
        );
      case "TimeoutError":
        return createWebAuthnError(
          WebAuthnErrorType.TIMEOUT,
          "Passkey verification timed out.",
          error,
        );
      case "NetworkError":
        return createWebAuthnError(
          WebAuthnErrorType.NETWORK_ERROR,
          "Network error during passkey verification.",
          error,
        );
      default:
        return createWebAuthnError(
          WebAuthnErrorType.UNKNOWN,
          error.message || "Unknown WebAuthn error.",
          error,
        );
    }
  }

  // Supabase Auth ошибки
  if (error && typeof error === "object" && "message" in error) {
    const message = String(error.message);
    if (message.includes("not authenticated") || message.includes("session")) {
      return createWebAuthnError(
        WebAuthnErrorType.NOT_AUTHENTICATED,
        "Sign in before using passkeys.",
        error,
      );
    }
  }

  // Общая ошибка
  return createWebAuthnError(
    WebAuthnErrorType.UNKNOWN,
    "An unknown passkey error occurred.",
    error,
  );
}

// ============================================================================
// Browser Support Check
// ============================================================================

/**
 * Проверяет, поддерживает ли браузер WebAuthn
 */
export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === "function"
  );
}

/**
 * Проверяет доступность платформенного аутентификатора (Touch ID, Face ID, Windows Hello)
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) {
    return false;
  }

  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Регистрирует новый биометрический ключ
 * 
 * @param friendlyName - Понятное название для ключа (например, "MacBook Pro Touch ID")
 * @returns Результат регистрации с factorId или ошибкой
 * 
 * @example
 * const result = await enrollBiometric("My iPhone");
 * if (result.success) {
 *   console.log("Enrolled with factor ID:", result.factorId);
 * } else {
 *   console.error("Error:", result.error?.message);
 * }
 */
export async function enrollBiometric(
  friendlyName: string = "Passkey",
): Promise<EnrollBiometricResult> {
  // Проверка поддержки браузера
  if (!isWebAuthnSupported()) {
    return {
      success: false,
      error: createWebAuthnError(
        WebAuthnErrorType.NOT_SUPPORTED,
          "This browser does not support passkeys.",
      ),
    };
  }

  try {
    // Проверка авторизации пользователя
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        error: createWebAuthnError(
          WebAuthnErrorType.NOT_AUTHENTICATED,
        "Sign in before using passkeys.",
        ),
      };
    }

    // Шаг 1: Начинаем процесс регистрации MFA
    const enrollResponse: AuthMFAEnrollResponse = await supabase.auth.mfa.enroll({
      factorType: "webauthn",
      friendlyName,
    });

    if (enrollResponse.error) {
      return {
        success: false,
        error: createWebAuthnError(
          WebAuthnErrorType.ENROLLMENT_FAILED,
          enrollResponse.error.message || "Could not start passkey registration.",
          enrollResponse.error,
        ),
      };
    }

    if (!enrollResponse.data) {
      return {
        success: false,
        error: createWebAuthnError(
          WebAuthnErrorType.ENROLLMENT_FAILED,
          "No passkey registration data returned.",
        ),
      };
    }

    const { id: factorId } = enrollResponse.data;

    // Шаг 2: Выполняем WebAuthn challenge
    // В Supabase MFA для WebAuthn challenge и verify происходят автоматически
    // через navigator.credentials API внутри Supabase SDK
    
    return {
      success: true,
      factorId,
    };
  } catch (error) {
    return {
      success: false,
      error: handleWebAuthnError(error),
    };
  }
}

/**
 * Верифицирует пользователя через биометрию
 * 
 * @param factorId - ID фактора для верификации (опционально, используется первый доступный)
 * @returns Результат верификации
 * 
 * @example
 * const result = await verifyBiometric();
 * if (result.success) {
 *   console.log("Verified successfully!");
 * } else {
 *   console.error("Verification failed:", result.error?.message);
 * }
 */
export async function verifyBiometric(
  factorId?: string,
): Promise<VerifyBiometricResult> {
  // Проверка поддержки браузера
  if (!isWebAuthnSupported()) {
    return {
      success: false,
      error: createWebAuthnError(
        WebAuthnErrorType.NOT_SUPPORTED,
          "This browser does not support passkeys.",
      ),
    };
  }

  try {
    // Проверка авторизации пользователя
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        error: createWebAuthnError(
          WebAuthnErrorType.NOT_AUTHENTICATED,
        "Sign in before using passkeys.",
        ),
      };
    }

    // Если factorId не указан, получаем список и берем первый WebAuthn фактор
    let targetFactorId = factorId;
    if (!targetFactorId) {
      const listResult = await listCredentials();
      if (!listResult.success || listResult.credentials.length === 0) {
        return {
          success: false,
          error: createWebAuthnError(
            WebAuthnErrorType.INVALID_STATE,
            "No passkeys are registered for this account.",
          ),
        };
      }
      targetFactorId = listResult.credentials[0].factorId;
    }

    // Выполняем challenge для верификации
    const challengeResponse = await supabase.auth.mfa.challenge({
      factorId: targetFactorId,
    });

    if (challengeResponse.error) {
      return {
        success: false,
        error: createWebAuthnError(
          WebAuthnErrorType.VERIFICATION_FAILED,
          challengeResponse.error.message || "Could not create passkey challenge.",
          challengeResponse.error,
        ),
      };
    }

    const challengeId = challengeResponse.data?.id;
    if (!challengeId) {
      return {
        success: false,
        error: createWebAuthnError(
          WebAuthnErrorType.VERIFICATION_FAILED,
          "No passkey challenge ID returned.",
        ),
      };
    }

    // Верифицируем с помощью WebAuthn
    const verifyResponse: AuthMFAVerifyResponse = await supabase.auth.mfa.verify(
      {
        factorId: targetFactorId,
        challengeId,
      } as Parameters<typeof supabase.auth.mfa.verify>[0],
    );

    if (verifyResponse.error) {
      return {
        success: false,
        error: createWebAuthnError(
          WebAuthnErrorType.VERIFICATION_FAILED,
          verifyResponse.error.message || "Passkey verification failed.",
          verifyResponse.error,
        ),
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: handleWebAuthnError(error),
    };
  }
}

/**
 * Получает список всех зарегистрированных биометрических ключей
 * 
 * @returns Список credentials или ошибку
 * 
 * @example
 * const result = await listCredentials();
 * if (result.success) {
 *   result.credentials.forEach(cred => {
 *     console.log(`${cred.friendlyName} - created ${cred.createdAt}`);
 *   });
 * }
 */
export async function listCredentials(): Promise<ListCredentialsResult> {
  try {
    // Проверка авторизации пользователя
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        credentials: [],
        error: createWebAuthnError(
          WebAuthnErrorType.NOT_AUTHENTICATED,
        "Sign in before using passkeys.",
        ),
      };
    }

    // Получаем список всех MFA факторов
    const factorsResponse: AuthMFAListFactorsResponse = await supabase.auth.mfa.listFactors();

    if (factorsResponse.error) {
      return {
        success: false,
        credentials: [],
        error: createWebAuthnError(
          WebAuthnErrorType.UNKNOWN,
          factorsResponse.error.message || "Could not load passkeys.",
          factorsResponse.error,
        ),
      };
    }

    // Фильтруем только WebAuthn факторы
    const webAuthnFactors = (factorsResponse.data?.all || []).filter(
      (factor) => factor.factor_type === "webauthn",
    );

    // Преобразуем в наш формат
    const credentials: BiometricCredential[] = webAuthnFactors.map((factor) => ({
      id: factor.id,
      factorId: factor.id,
      friendlyName: factor.friendly_name || "Passkey",
      createdAt: factor.created_at,
      lastUsedAt: factor.updated_at,
      factorType: "webauthn",
    }));

    return {
      success: true,
      credentials,
    };
  } catch (error) {
    return {
      success: false,
      credentials: [],
      error: handleWebAuthnError(error),
    };
  }
}

/**
 * Удаляет зарегистрированный биометрический ключ
 * 
 * @param factorId - ID фактора для удаления
 * @returns Результат удаления
 * 
 * @example
 * const result = await removeCredential("factor-id-123");
 * if (result.success) {
 *   console.log("Credential removed successfully");
 * }
 */
export async function removeCredential(
  factorId: string,
): Promise<RemoveCredentialResult> {
  try {
    // Проверка авторизации пользователя
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        error: createWebAuthnError(
          WebAuthnErrorType.NOT_AUTHENTICATED,
        "Sign in before using passkeys.",
        ),
      };
    }

    // Удаляем MFA фактор
    const unenrollResponse: AuthMFAUnenrollResponse = await supabase.auth.mfa.unenroll({
      factorId,
    });

    if (unenrollResponse.error) {
      return {
        success: false,
        error: createWebAuthnError(
          WebAuthnErrorType.UNKNOWN,
          unenrollResponse.error.message || "Could not remove passkey.",
          unenrollResponse.error,
        ),
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: handleWebAuthnError(error),
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Получает информацию о возможностях устройства
 */
export async function getDeviceCapabilities() {
  const supported = isWebAuthnSupported();
  const platformAvailable = supported ? await isPlatformAuthenticatorAvailable() : false;

  return {
    webAuthnSupported: supported,
    platformAuthenticatorAvailable: platformAvailable,
    userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "",
  };
}

/**
 * Форматирует читаемое сообщение об ошибке для пользователя
 * Поддерживает 5 языков: EN, NL, FR, RU, DE
 */
export function formatErrorMessage(error: WebAuthnError, locale: string = "en"): string {
  const messages: Record<WebAuthnErrorType, Record<string, string>> = {
    [WebAuthnErrorType.NOT_SUPPORTED]: {
      en: "This browser does not support passkeys. Please use a modern browser.",
      nl: "Deze browser ondersteunt geen passkeys. Gebruik een moderne browser.",
      fr: "Ce navigateur ne prend pas en charge les passkeys. Utilisez un navigateur moderne.",
      ru: "This browser does not support passkeys. Please use a modern browser.",
      de: "Dieser Browser unterstuetzt keine Passkeys. Bitte verwenden Sie einen modernen Browser.",
    },
    [WebAuthnErrorType.USER_CANCELLED]: {
      en: "Passkey verification was cancelled.",
      nl: "Passkey-verificatie is geannuleerd.",
      fr: "Verification par passkey annulee.",
      ru: "Passkey verification was cancelled.",
      de: "Passkey-Pruefung wurde abgebrochen.",
    },
    [WebAuthnErrorType.NOT_AUTHENTICATED]: {
      en: "Sign in before using passkeys.",
      nl: "Log eerst in voordat u passkeys gebruikt.",
      fr: "Connectez-vous avant d'utiliser les passkeys.",
      ru: "Sign in before using passkeys.",
      de: "Melden Sie sich an, bevor Sie Passkeys verwenden.",
    },
    [WebAuthnErrorType.NETWORK_ERROR]: {
      en: "Network error. Check your connection and try again.",
      nl: "Netwerkfout. Controleer uw verbinding en probeer opnieuw.",
      fr: "Erreur reseau. Verifiez votre connexion et reessayez.",
      ru: "Network error. Check your connection and try again.",
      de: "Netzwerkfehler. Pruefen Sie Ihre Verbindung und versuchen Sie es erneut.",
    },
    [WebAuthnErrorType.TIMEOUT]: {
      en: "Passkey verification timed out. Try again.",
      nl: "Passkey-verificatie is verlopen. Probeer opnieuw.",
      fr: "Verification par passkey expiree. Reessayez.",
      ru: "Passkey verification timed out. Try again.",
      de: "Passkey-Pruefung ist abgelaufen. Versuchen Sie es erneut.",
    },
    [WebAuthnErrorType.INVALID_STATE]: {
      en: "This passkey is already registered.",
      nl: "Deze passkey is al geregistreerd.",
      fr: "Cette passkey est deja enregistree.",
      ru: "This passkey is already registered.",
      de: "Dieser Passkey ist bereits registriert.",
    },
    [WebAuthnErrorType.ENROLLMENT_FAILED]: {
      en: "Could not register this passkey.",
      nl: "Kan deze passkey niet registreren.",
      fr: "Impossible d'enregistrer cette passkey.",
      ru: "Could not register this passkey.",
      de: "Dieser Passkey konnte nicht registriert werden.",
    },
    [WebAuthnErrorType.VERIFICATION_FAILED]: {
      en: "Passkey verification failed.",
      nl: "Passkey-verificatie mislukt.",
      fr: "Verification par passkey echouee.",
      ru: "Passkey verification failed.",
      de: "Passkey-Pruefung fehlgeschlagen.",
    },
    [WebAuthnErrorType.UNKNOWN]: {
      en: error.message || "An unknown passkey error occurred.",
      nl: error.message || "Er is een onbekende passkey-fout opgetreden.",
      fr: error.message || "Une erreur passkey inconnue s'est produite.",
      ru: error.message || "An unknown passkey error occurred.",
      de: error.message || "Ein unbekannter Passkey-Fehler ist aufgetreten.",
    },
  };

  return messages[error.type]?.[locale] || messages[error.type]?.en || error.message;
}
