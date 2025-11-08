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
          "Ваш браузер не поддерживает биометрическую авторизацию",
          error,
        );
      case "NotAllowedError":
        return createWebAuthnError(
          WebAuthnErrorType.USER_CANCELLED,
          "Авторизация отменена пользователем",
          error,
        );
      case "InvalidStateError":
        return createWebAuthnError(
          WebAuthnErrorType.INVALID_STATE,
          "Биометрический ключ уже зарегистрирован",
          error,
        );
      case "TimeoutError":
        return createWebAuthnError(
          WebAuthnErrorType.TIMEOUT,
          "Время ожидания истекло",
          error,
        );
      case "NetworkError":
        return createWebAuthnError(
          WebAuthnErrorType.NETWORK_ERROR,
          "Ошибка сети при авторизации",
          error,
        );
      default:
        return createWebAuthnError(
          WebAuthnErrorType.UNKNOWN,
          error.message || "Неизвестная ошибка WebAuthn",
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
        "Необходимо войти в систему для использования биометрии",
        error,
      );
    }
  }

  // Общая ошибка
  return createWebAuthnError(
    WebAuthnErrorType.UNKNOWN,
    "Произошла неизвестная ошибка",
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
  friendlyName: string = "Biometric Key",
): Promise<EnrollBiometricResult> {
  // Проверка поддержки браузера
  if (!isWebAuthnSupported()) {
    return {
      success: false,
      error: createWebAuthnError(
        WebAuthnErrorType.NOT_SUPPORTED,
        "Ваш браузер не поддерживает биометрическую авторизацию",
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
          "Необходимо войти в систему для регистрации биометрии",
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
          enrollResponse.error.message || "Не удалось начать регистрацию",
          enrollResponse.error,
        ),
      };
    }

    if (!enrollResponse.data) {
      return {
        success: false,
        error: createWebAuthnError(
          WebAuthnErrorType.ENROLLMENT_FAILED,
          "Не получены данные для регистрации",
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
        "Ваш браузер не поддерживает биометрическую авторизацию",
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
          "Необходимо войти в систему",
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
            "Нет зарегистрированных биометрических ключей",
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
          challengeResponse.error.message || "Не удалось создать challenge",
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
          "Не получен challenge ID",
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
          verifyResponse.error.message || "Верификация не удалась",
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
          "Необходимо войти в систему",
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
          factorsResponse.error.message || "Не удалось получить список ключей",
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
      friendlyName: factor.friendly_name || "Biometric Key",
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
          "Необходимо войти в систему",
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
          unenrollResponse.error.message || "Не удалось удалить ключ",
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
      en: "Your browser doesn't support biometric authentication. Please use a modern browser.",
      nl: "Uw browser ondersteunt geen biometrische authenticatie. Gebruik een moderne browser.",
      fr: "Votre navigateur ne prend pas en charge l'authentification biométrique.",
      ru: "Ваш браузер не поддерживает биометрическую авторизацию.",
      de: "Ihr Browser unterstützt keine biometrische Authentifizierung. Bitte verwenden Sie einen modernen Browser.",
    },
    [WebAuthnErrorType.USER_CANCELLED]: {
      en: "Authentication was cancelled.",
      nl: "Authenticatie is geannuleerd.",
      fr: "L'authentification a été annulée.",
      ru: "Авторизация отменена.",
      de: "Die Authentifizierung wurde abgebrochen.",
    },
    [WebAuthnErrorType.NOT_AUTHENTICATED]: {
      en: "You need to log in first.",
      nl: "U moet eerst inloggen.",
      fr: "Vous devez d'abord vous connecter.",
      ru: "Необходимо войти в систему.",
      de: "Sie müssen sich zuerst anmelden.",
    },
    [WebAuthnErrorType.NETWORK_ERROR]: {
      en: "Network error occurred. Please check your connection.",
      nl: "Netwerkfout opgetreden. Controleer uw verbinding.",
      fr: "Erreur réseau. Vérifiez votre connexion.",
      ru: "Ошибка сети. Проверьте подключение.",
      de: "Netzwerkfehler aufgetreten. Bitte überprüfen Sie Ihre Verbindung.",
    },
    [WebAuthnErrorType.TIMEOUT]: {
      en: "Authentication timed out. Please try again.",
      nl: "Time-out bij authenticatie. Probeer het opnieuw.",
      fr: "Délai d'authentification dépassé. Réessayez.",
      ru: "Время ожидания истекло. Попробуйте снова.",
      de: "Authentifizierungs-Timeout. Bitte versuchen Sie es erneut.",
    },
    [WebAuthnErrorType.INVALID_STATE]: {
      en: "This biometric key is already registered.",
      nl: "Deze biometrische sleutel is al geregistreerd.",
      fr: "Cette clé biométrique est déjà enregistrée.",
      ru: "Этот биометрический ключ уже зарегистрирован.",
      de: "Dieser biometrische Schlüssel ist bereits registriert.",
    },
    [WebAuthnErrorType.ENROLLMENT_FAILED]: {
      en: "Failed to register biometric key.",
      nl: "Kan biometrische sleutel niet registreren.",
      fr: "Impossible d'enregistrer la clé biométrique.",
      ru: "Не удалось зарегистрировать биометрический ключ.",
      de: "Biometrischer Schlüssel konnte nicht registriert werden.",
    },
    [WebAuthnErrorType.VERIFICATION_FAILED]: {
      en: "Biometric verification failed.",
      nl: "Biometrische verificatie mislukt.",
      fr: "Échec de la vérification biométrique.",
      ru: "Биометрическая верификация не удалась.",
      de: "Biometrische Überprüfung fehlgeschlagen.",
    },
    [WebAuthnErrorType.UNKNOWN]: {
      en: error.message || "An unknown error occurred.",
      nl: error.message || "Er is een onbekende fout opgetreden.",
      fr: error.message || "Une erreur inconnue s'est produite.",
      ru: error.message || "Произошла неизвестная ошибка.",
      de: error.message || "Ein unbekannter Fehler ist aufgetreten.",
    },
  };

  return messages[error.type]?.[locale] || messages[error.type]?.en || error.message;
}

