/**
 * TypeScript типы для WebAuthn операций
 * 
 * Типы для API endpoints, request/response объектов и внутренней логики
 */

import type { WebAuthnError, BiometricCredential } from "@/lib/webauthn";

// ============================================================================
// API Request Types
// ============================================================================

/**
 * Request для регистрации биометрического ключа
 */
export interface WebAuthnEnrollRequest {
  /** Дружественное название устройства */
  friendlyName?: string;
}

/**
 * Request для верификации через биометрию
 */
export interface WebAuthnVerifyRequest {
  /** ID фактора для верификации (опционально) */
  factorId?: string;
}

/**
 * Request для удаления биометрического ключа
 */
export interface WebAuthnRemoveRequest {
  /** ID фактора для удаления */
  factorId: string;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Success response для регистрации
 */
export interface WebAuthnEnrollResponse {
  ok: true;
  data: {
    /** ID зарегистрированного фактора */
    factorId: string;
    /** Дружественное название */
    friendlyName: string;
  };
}

/**
 * Success response для верификации
 */
export interface WebAuthnVerifyResponse {
  ok: true;
  data: {
    /** Успешно ли прошла верификация */
    verified: boolean;
  };
}

/**
 * Success response для списка credentials
 */
export interface WebAuthnListResponse {
  ok: true;
  data: {
    /** Список биометрических ключей */
    credentials: BiometricCredential[];
  };
}

/**
 * Success response для удаления
 */
export interface WebAuthnRemoveResponse {
  ok: true;
  data: {
    /** Успешно ли удален */
    removed: boolean;
  };
}

/**
 * Error response для всех WebAuthn endpoints
 */
export interface WebAuthnErrorResponse {
  ok: false;
  /** Код ошибки */
  error: string;
  /** Детальное описание ошибки */
  detail?: string;
}

// ============================================================================
// Union Types для API Responses
// ============================================================================

export type WebAuthnEnrollApiResponse = WebAuthnEnrollResponse | WebAuthnErrorResponse;
export type WebAuthnVerifyApiResponse = WebAuthnVerifyResponse | WebAuthnErrorResponse;
export type WebAuthnListApiResponse = WebAuthnListResponse | WebAuthnErrorResponse;
export type WebAuthnRemoveApiResponse = WebAuthnRemoveResponse | WebAuthnErrorResponse;

// ============================================================================
// Database Types (если нужны расширения)
// ============================================================================

/**
 * Расширенная информация о биометрическом ключе в профиле
 */
export interface BiometricProfileSettings {
  /** Включена ли биометрическая авторизация для пользователя */
  biometricEnabled: boolean;
  /** Количество зарегистрированных устройств */
  deviceCount: number;
  /** Дата последнего использования биометрии */
  lastUsedAt?: string;
}

// ============================================================================
// Client-side Types
// ============================================================================

/**
 * Опции для клиентской функции регистрации
 */
export interface EnrollBiometricOptions {
  /** Дружественное название */
  friendlyName?: string;
  /** Callback при успехе */
  onSuccess?: (factorId: string) => void;
  /** Callback при ошибке */
  onError?: (error: WebAuthnError) => void;
}

/**
 * Опции для клиентской функции верификации
 */
export interface VerifyBiometricOptions {
  /** ID фактора */
  factorId?: string;
  /** Callback при успехе */
  onSuccess?: () => void;
  /** Callback при ошибке */
  onError?: (error: WebAuthnError) => void;
  /** Автоматически перенаправить после успеха */
  redirectTo?: string;
}

// ============================================================================
// Validation Schemas (для использования с Zod в API endpoints)
// ============================================================================

/**
 * Схема для валидации friendlyName
 */
export const FRIENDLY_NAME_MAX_LENGTH = 100;
export const FRIENDLY_NAME_MIN_LENGTH = 1;

/**
 * Схема для валидации factorId (UUID формат)
 */
export const FACTOR_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================================
// Error Codes для API
// ============================================================================

/**
 * Коды ошибок специфичные для WebAuthn API
 */
export enum WebAuthnApiErrorCode {
  /** Браузер не поддерживает WebAuthn */
  NOT_SUPPORTED = "WEBAUTHN_NOT_SUPPORTED",
  /** Пользователь отменил операцию */
  USER_CANCELLED = "WEBAUTHN_USER_CANCELLED",
  /** Пользователь не авторизован */
  NOT_AUTHENTICATED = "NOT_AUTHENTICATED",
  /** Фактор не найден */
  FACTOR_NOT_FOUND = "WEBAUTHN_FACTOR_NOT_FOUND",
  /** Регистрация не удалась */
  ENROLLMENT_FAILED = "WEBAUTHN_ENROLLMENT_FAILED",
  /** Верификация не удалась */
  VERIFICATION_FAILED = "WEBAUTHN_VERIFICATION_FAILED",
  /** Удаление не удалось */
  REMOVAL_FAILED = "WEBAUTHN_REMOVAL_FAILED",
  /** Невалидные входные данные */
  INVALID_INPUT = "INVALID_INPUT",
  /** Внутренняя ошибка сервера */
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Проверяет, является ли response успешным
 */
export function isWebAuthnSuccess<T extends { ok: boolean }>(
  response: T,
): response is Extract<T, { ok: true }> {
  return response.ok === true;
}

/**
 * Проверяет, является ли response ошибкой
 */
export function isWebAuthnError<T extends { ok: boolean }>(
  response: T,
): response is Extract<T, { ok: false }> {
  return response.ok === false;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Извлекает data из успешного response
 */
export type ExtractData<T> = T extends { ok: true; data: infer D } ? D : never;

/**
 * Извлекает error из error response
 */
export type ExtractError<T> = T extends { ok: false; error: infer E } ? E : never;






