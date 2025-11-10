/**
 * React hook для работы с WebAuthn биометрической авторизацией
 * 
 * Предоставляет удобный интерфейс для:
 * - Регистрации биометрических ключей
 * - Верификации через биометрию
 * - Управления списком ключей
 * - Проверки поддержки браузера
 * 
 * @example
 * function BiometricSettings() {
 *   const {
 *     isSupported,
 *     credentials,
 *     isLoading,
 *     enroll,
 *     verify,
 *     remove,
 *     refresh,
 *   } = useWebAuthn();
 * 
 *   if (!isSupported) {
 *     return <div>Browser not supported</div>;
 *   }
 * 
 *   return (
 *     <div>
 *       <button onClick={() => enroll("My Device")}>
 *         Add Biometric
 *       </button>
 *       {credentials.map(cred => (
 *         <div key={cred.id}>
 *           {cred.friendlyName}
 *           <button onClick={() => remove(cred.factorId)}>Remove</button>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 */

import { useState, useEffect, useCallback } from "react";
import {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  enrollBiometric,
  verifyBiometric,
  listCredentials,
  removeCredential,
  getDeviceCapabilities,
  formatErrorMessage,
  type BiometricCredential,
  type WebAuthnError,
} from "@/lib/webauthn";

// ============================================================================
// Types
// ============================================================================

/**
 * State hook'а useWebAuthn
 */
export interface UseWebAuthnState {
  /** Поддерживает ли браузер WebAuthn */
  isSupported: boolean;
  /** Доступен ли платформенный аутентификатор (Touch ID, Face ID и т.д.) */
  isPlatformAvailable: boolean;
  /** Список зарегистрированных биометрических ключей */
  credentials: BiometricCredential[];
  /** Загружается ли список credentials */
  isLoading: boolean;
  /** Выполняется ли регистрация нового ключа */
  isEnrolling: boolean;
  /** Выполняется ли верификация */
  isVerifying: boolean;
  /** Выполняется ли удаление ключа */
  isRemoving: boolean;
  /** Последняя ошибка */
  error: WebAuthnError | null;
}

/**
 * Actions hook'а useWebAuthn
 */
export interface UseWebAuthnActions {
  /** Зарегистрировать новый биометрический ключ */
  enroll: (friendlyName?: string) => Promise<boolean>;
  /** Верифицировать пользователя через биометрию */
  verify: (factorId?: string) => Promise<boolean>;
  /** Удалить биометрический ключ */
  remove: (factorId: string) => Promise<boolean>;
  /** Обновить список credentials */
  refresh: () => Promise<void>;
  /** Очистить ошибку */
  clearError: () => void;
  /** Получить форматированное сообщение об ошибке */
  getErrorMessage: (locale?: string) => string;
}

/**
 * Полный return type hook'а
 */
export type UseWebAuthnReturn = UseWebAuthnState & UseWebAuthnActions;

/**
 * Опции для hook'а
 */
export interface UseWebAuthnOptions {
  /** Автоматически загружать список credentials при монтировании */
  autoLoad?: boolean;
  /** Callback при успешной регистрации */
  onEnrollSuccess?: (factorId: string) => void;
  /** Callback при успешной верификации */
  onVerifySuccess?: () => void;
  /** Callback при успешном удалении */
  onRemoveSuccess?: (factorId: string) => void;
  /** Callback при ошибке */
  onError?: (error: WebAuthnError) => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * React hook для работы с WebAuthn биометрией
 */
export function useWebAuthn(options: UseWebAuthnOptions = {}): UseWebAuthnReturn {
  const {
    autoLoad = true,
    onEnrollSuccess,
    onVerifySuccess,
    onRemoveSuccess,
    onError,
  } = options;

  // ========================================
  // State
  // ========================================

  const [isSupported, setIsSupported] = useState(false);
  const [isPlatformAvailable, setIsPlatformAvailable] = useState(false);
  const [credentials, setCredentials] = useState<BiometricCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<WebAuthnError | null>(null);

  // ========================================
  // Effects
  // ========================================

  /**
   * Проверяем поддержку браузера при монтировании
   */
  useEffect(() => {
    async function checkSupport() {
      const capabilities = await getDeviceCapabilities();
      setIsSupported(capabilities.webAuthnSupported);
      setIsPlatformAvailable(capabilities.platformAuthenticatorAvailable);
    }

    checkSupport();
  }, []);

  /**
   * Загружаем список credentials при монтировании
   */
  useEffect(() => {
    if (autoLoad && isSupported) {
      void refresh();
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, isSupported]);

  // ========================================
  // Actions
  // ========================================

  /**
   * Обновить список credentials
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await listCredentials();

      if (result.success) {
        setCredentials(result.credentials);
      } else if (result.error) {
        setError(result.error);
        if (onError) {
          onError(result.error);
        }
      }
    } catch (err) {
      console.error("Failed to refresh credentials:", err);
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  /**
   * Зарегистрировать новый биометрический ключ
   */
  const enroll = useCallback(
    async (friendlyName?: string): Promise<boolean> => {
      if (!isSupported) {
        return false;
      }

      setIsEnrolling(true);
      setError(null);

      try {
        const result = await enrollBiometric(friendlyName);

        if (result.success && result.factorId) {
          // Обновляем список credentials
          await refresh();

          if (onEnrollSuccess) {
            onEnrollSuccess(result.factorId);
          }

          return true;
        } else if (result.error) {
          setError(result.error);
          if (onError) {
            onError(result.error);
          }
          return false;
        }

        return false;
      } catch (err) {
        console.error("Enrollment error:", err);
        return false;
      } finally {
        setIsEnrolling(false);
      }
    },
    [isSupported, refresh, onEnrollSuccess, onError],
  );

  /**
   * Верифицировать пользователя через биометрию
   */
  const verify = useCallback(
    async (factorId?: string): Promise<boolean> => {
      if (!isSupported) {
        return false;
      }

      setIsVerifying(true);
      setError(null);

      try {
        const result = await verifyBiometric(factorId);

        if (result.success) {
          if (onVerifySuccess) {
            onVerifySuccess();
          }
          return true;
        } else if (result.error) {
          setError(result.error);
          if (onError) {
            onError(result.error);
          }
          return false;
        }

        return false;
      } catch (err) {
        console.error("Verification error:", err);
        return false;
      } finally {
        setIsVerifying(false);
      }
    },
    [isSupported, onVerifySuccess, onError],
  );

  /**
   * Удалить биометрический ключ
   */
  const remove = useCallback(
    async (factorId: string): Promise<boolean> => {
      if (!isSupported) {
        return false;
      }

      setIsRemoving(true);
      setError(null);

      try {
        const result = await removeCredential(factorId);

        if (result.success) {
          // Обновляем список credentials
          await refresh();

          if (onRemoveSuccess) {
            onRemoveSuccess(factorId);
          }

          return true;
        } else if (result.error) {
          setError(result.error);
          if (onError) {
            onError(result.error);
          }
          return false;
        }

        return false;
      } catch (err) {
        console.error("Remove error:", err);
        return false;
      } finally {
        setIsRemoving(false);
      }
    },
    [isSupported, refresh, onRemoveSuccess, onError],
  );

  /**
   * Очистить ошибку
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Получить форматированное сообщение об ошибке
   */
  const getErrorMessage = useCallback(
    (locale: string = "en"): string => {
      if (!error) {
        return "";
      }
      return formatErrorMessage(error, locale);
    },
    [error],
  );

  // ========================================
  // Return
  // ========================================

  return {
    // State
    isSupported,
    isPlatformAvailable,
    credentials,
    isLoading,
    isEnrolling,
    isVerifying,
    isRemoving,
    error,

    // Actions
    enroll,
    verify,
    remove,
    refresh,
    clearError,
    getErrorMessage,
  };
}

// ============================================================================
// Additional Hooks
// ============================================================================

/**
 * Упрощенный hook для быстрой проверки поддержки WebAuthn
 * 
 * @example
 * function MyComponent() {
 *   const supported = useWebAuthnSupport();
 *   if (!supported) return <div>Not supported</div>;
 *   return <div>Supported!</div>;
 * }
 */
export function useWebAuthnSupport(): boolean {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(isWebAuthnSupported());
  }, []);

  return supported;
}

/**
 * Hook для проверки доступности платформенного аутентификатора
 * 
 * @example
 * function MyComponent() {
 *   const { available, loading } = usePlatformAuthenticator();
 *   if (loading) return <div>Checking...</div>;
 *   if (!available) return <div>No biometric available</div>;
 *   return <div>Biometric available!</div>;
 * }
 */
export function usePlatformAuthenticator() {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      const isAvailable = await isPlatformAuthenticatorAvailable();
      setAvailable(isAvailable);
      setLoading(false);
    }

    check();
  }, []);

  return { available, loading };
}

// ============================================================================
// Export default
// ============================================================================

export default useWebAuthn;











