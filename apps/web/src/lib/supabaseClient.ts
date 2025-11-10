import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabaseTypes";

// Создаем singleton клиент с улучшенной обработкой сессий
export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  { 
    isSingleton: true,
    auth: {
      // Автоматическое обновление токена
      autoRefreshToken: true,
      // Persist сессии в localStorage
      persistSession: true,
      // Detect session в URL (для magic links)
      detectSessionInUrl: true,
      // ВАЖНО: Не переопределяем storage и storageKey - используем дефолтные
      // Это необходимо для корректной работы PKCE flow
    }
  }
);

// ============================================================================
// Session Management Functions
// ============================================================================

/**
 * Проверяет, истек ли токен сессии
 */
export async function isSessionExpired(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return true;
  }

  const expiresAt = session.expires_at;
  if (!expiresAt) {
    return false;
  }

  // Проверяем, истекла ли сессия (с запасом в 60 секунд)
  const now = Math.floor(Date.now() / 1000);
  return expiresAt - now < 60;
}

/**
 * Обновляет сессию принудительно
 */
export async function refreshSession(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error("Failed to refresh session:", error);
      return false;
    }

    return !!data.session;
  } catch (error) {
    console.error("Exception during session refresh:", error);
    return false;
  }
}

/**
 * Проверяет и обновляет сессию при необходимости
 */
export async function ensureValidSession(): Promise<boolean> {
  const expired = await isSessionExpired();
  
  if (expired) {
    return await refreshSession();
  }

  return true;
}

// ============================================================================
// Auto Refresh Setup
// ============================================================================

// Настраиваем автоматическое обновление сессии перед истечением
if (typeof window !== "undefined") {
  let refreshTimer: NodeJS.Timeout | null = null;

  // Функция для планирования обновления
  const scheduleRefresh = (expiresAt: number) => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresIn = expiresAt - now;
    
    // Обновляем за 5 минут до истечения (или через 50% времени, если сессия короткая)
    const refreshIn = Math.max(expiresIn - 300, expiresIn * 0.5);
    const refreshInMs = refreshIn * 1000;

    if (refreshInMs > 0) {
      refreshTimer = setTimeout(async () => {
        console.log("Auto-refreshing session...");
        const success = await refreshSession();
        
        if (success) {
          console.log("Session refreshed successfully");
        } else {
          console.error("Failed to auto-refresh session");
        }
      }, refreshInMs);
    }
  };

  // Слушаем изменения auth state
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session?.expires_at) {
      scheduleRefresh(session.expires_at);
      // Notify other components (like header) about auth state change
      window.dispatchEvent(new CustomEvent("auth-state-change", { detail: { event, session } }));
    } else if (event === "SIGNED_OUT") {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
      }
      // Notify about sign out
      window.dispatchEvent(new CustomEvent("auth-state-change", { detail: { event, session: null } }));
    } else if (event === "TOKEN_REFRESHED" && session?.expires_at) {
      scheduleRefresh(session.expires_at);
    } else if (event === "USER_UPDATED" || event === "MFA_CHALLENGE_VERIFIED") {
      // Notify about user updates or MFA changes
      window.dispatchEvent(new CustomEvent("auth-state-change", { detail: { event, session } }));
    }
  });

  // Проверяем текущую сессию при загрузке
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.expires_at) {
      scheduleRefresh(session.expires_at);
    }
  });
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Обработчик ошибок аутентификации
 */
export function handleAuthError(error: any): void {
  if (error?.message?.includes("refresh_token_not_found")) {
    // Токен обновления не найден - нужен повторный вход
    console.error("Refresh token not found, user needs to re-authenticate");
    // Можно перенаправить на страницу входа
    if (typeof window !== "undefined") {
      window.location.href = "/login?error=session_expired&message=Ваша сессия истекла. Войдите снова";
    }
  } else if (error?.message?.includes("Invalid Refresh Token")) {
    // Невалидный токен обновления
    console.error("Invalid refresh token");
    if (typeof window !== "undefined") {
      window.location.href = "/login?error=invalid_token&message=Ошибка авторизации. Войдите снова";
    }
  }
}
