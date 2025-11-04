import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { logger } from "@/lib/errorLogger";
import type { Database } from "@/lib/supabaseTypes";

export const runtime = "nodejs";

/**
 * Auth callback handler for OAuth and email confirmations
 * Handles code exchange and redirects to the appropriate page
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const next = url.searchParams.get("next") ?? "/profile";

  // Collect cookies to set in response
  const cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }> = [];

  // Create Supabase client with proper cookie handling for route handlers
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookiesToSet.push({ name, value, options });
        },
        remove(name: string, options: CookieOptions) {
          cookiesToSet.push({ name, value: "", options: { ...options, maxAge: 0 } });
        },
      },
    }
  );

  // Handle OAuth/email errors
  if (error) {
    logger.error("Auth callback received error", {
      component: "AuthCallback",
      action: "handleOAuthError",
      metadata: {
        error,
        description: errorDescription,
      },
    });

    const errorUrl = new URL("/login", url.origin);
    errorUrl.searchParams.set("error", error);
    
    if (errorDescription) {
      errorUrl.searchParams.set("message", errorDescription);
    }

    return NextResponse.redirect(errorUrl);
  }

  // Validate code parameter
  if (!code) {
    logger.error("Auth callback missing code parameter", {
      component: "AuthCallback",
      action: "validateCode",
    });
    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set("error", "missing_code");
    loginUrl.searchParams.set("message", "Неверная ссылка для входа");
    return NextResponse.redirect(loginUrl);
  }

  try {
    // Log the code exchange attempt
    logger.info("Attempting code exchange", {
      component: "AuthCallback",
      action: "exchangeCode",
      metadata: {
        codeLength: code.length,
        origin: url.origin,
      },
    });
    
    // Exchange code for session
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      logger.error("Auth callback code exchange failed", {
        component: "AuthCallback",
        action: "exchangeCode",
        metadata: {
          errorCode: exchangeError.code,
          errorMessage: exchangeError.message,
          errorStatus: exchangeError.status,
        },
        error: exchangeError,
      });

      const loginUrl = new URL("/login", url.origin);
      loginUrl.searchParams.set("error", "exchange_failed");
      
      // Handle specific errors with better messages
      if (exchangeError.message.includes("expired") || exchangeError.code === "otp_expired") {
        loginUrl.searchParams.set("message", "Ссылка истекла. Запросите новую ссылку для входа");
      } else if (exchangeError.message.includes("already used") || exchangeError.code === "otp_disabled") {
        loginUrl.searchParams.set("message", "Ссылка уже использована. Запросите новую");
      } else if (exchangeError.message.includes("Email link is invalid") || exchangeError.code === "bad_oauth_state") {
        loginUrl.searchParams.set("message", "Неверная ссылка. Запросите новую ссылку для входа");
      } else if (exchangeError.status === 422) {
        loginUrl.searchParams.set("message", "Неверный формат ссылки. Используйте ссылку из письма целиком");
      } else {
        loginUrl.searchParams.set("message", `Ошибка входа: ${exchangeError.message}`);
      }

      return NextResponse.redirect(loginUrl);
    }

    // Verify session was created
    if (!data.session) {
      logger.error("Auth callback no session created", {
        component: "AuthCallback",
        action: "verifySession",
      });
      const loginUrl = new URL("/login", url.origin);
      loginUrl.searchParams.set("error", "no_session");
      loginUrl.searchParams.set("message", "Не удалось создать сессию");
      return NextResponse.redirect(loginUrl);
    }

    // Successful authentication - redirect to next page
    logger.info("Auth callback successful", {
      component: "AuthCallback",
      action: "success",
      metadata: {
        userId: data.user?.id,
        email: data.user?.email,
        next,
      },
    });

    // Redirect with cookies set
    const redirectUrl = new URL(next, url.origin);
    const response = NextResponse.redirect(redirectUrl);
    
    // Set all collected cookies
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    
    return response;
  } catch (err) {
    // Catch unexpected errors
    logger.fatal("Auth callback unexpected error", {
      component: "AuthCallback",
      action: "handleException",
      error: err,
    });

    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set("error", "internal_error");
    loginUrl.searchParams.set(
      "message",
      "Произошла непредвиденная ошибка. Попробуйте снова"
    );
    return NextResponse.redirect(loginUrl);
  }
}
