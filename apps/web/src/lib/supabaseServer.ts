import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "@/lib/supabaseTypes";

/**
 * Создает Supabase клиент для Server Components с улучшенной обработкой сессий
 * 
 * Features:
 * - Автоматическое обновление refresh tokens
 * - Безопасное управление cookies
 * - Обработка истекших сессий
 * 
 * @example
 * const supabase = supabaseServer();
 * const { data } = await supabase.from('profiles').select('*');
 */
export function supabaseServer() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          const store = await cookieStore;
          return store.get(name)?.value;
        },
        async set(name: string, value: string, options: CookieOptions = {}) {
          try {
            const store = await cookieStore;
            await store.set({ 
              name, 
              value, 
              ...options,
              // Обеспечиваем безопасные настройки cookies
              secure: process.env.NODE_ENV === "production",
              httpOnly: true,
              sameSite: "lax",
              path: "/",
            });
          } catch (error) {
            // В некоторых контекстах (например, Server Actions) cookie операции могут быть недоступны
            console.error("Failed to set cookie:", error);
          }
        },
        async remove(name: string, options: CookieOptions = {}) {
          try {
            const store = await cookieStore;
            await store.set({ 
              name, 
              value: "", 
              ...options, 
              maxAge: 0,
              path: "/",
            });
          } catch (error) {
            console.error("Failed to remove cookie:", error);
          }
        },
      },
      auth: {
        // Автоматическое обновление токенов на сервере
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // На сервере не нужно проверять URL
      },
    },
  );
}

// ============================================================================
// Server-side Session Utilities
// ============================================================================

/**
 * Получает и валидирует текущую сессию на сервере
 * 
 * @returns Session object или null если сессия невалидна
 */
export async function getServerSession() {
  const supabase = supabaseServer();
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error("Error getting server session:", error);
      return null;
    }

    // Проверяем, не истекла ли сессия
    if (session?.expires_at) {
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = session.expires_at;
      
      // Если сессия истекла, пытаемся обновить
      if (expiresAt <= now) {
        console.log("Session expired, attempting to refresh...");
        const { data: { session: refreshedSession }, error: refreshError } = 
          await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error("Failed to refresh session:", refreshError);
          return null;
        }
        
        return refreshedSession;
      }
    }

    return session;
  } catch (error) {
    console.error("Exception getting server session:", error);
    return null;
  }
}

/**
 * Получает текущего пользователя на сервере с валидацией сессии
 * 
 * @returns User object или null
 */
export async function getServerUser() {
  const session = await getServerSession();
  return session?.user ?? null;
}

/**
 * Проверяет, аутентифицирован ли пользователь на сервере
 * 
 * @returns true если пользователь залогинен
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getServerSession();
  return !!session;
}

/**
 * Требует аутентификации - выбрасывает ошибку если пользователь не залогинен
 * Используется в API routes и Server Actions
 * 
 * @throws Error если пользователь не аутентифицирован
 */
export async function requireAuth() {
  const session = await getServerSession();
  
  if (!session) {
    throw new Error("Unauthorized: Authentication required");
  }
  
  return session;
}

/**
 * Проверяет, является ли пользователь администратором
 * @returns true если пользователь - администратор
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = supabaseServer();
  
  const session = await getServerSession();
  if (!session) return false;

  try {
    // Используем функцию is_admin из базы данных
    const { data, error } = await supabase.rpc("is_admin");
    
    if (error) {
      console.error("Error checking admin status:", error);
      return false;
    }
    
    return data === true;
  } catch (error) {
    console.error("Exception checking admin status:", error);
    return false;
  }
}
