import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { logger } from "@/lib/errorLogger";
import { supabaseService } from "@/lib/supabaseService";
import type { Database, TablesUpdate } from "@/lib/supabaseTypes";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const next = url.searchParams.get("next") ?? "/profile";
  const cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }> = [];

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
    },
  );

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

  if (!code) {
    logger.error("Auth callback missing code parameter", {
      component: "AuthCallback",
      action: "validateCode",
    });
    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set("error", "missing_code");
    loginUrl.searchParams.set("message", "This sign-in link is invalid.");
    return NextResponse.redirect(loginUrl);
  }

  try {
    logger.info("Attempting code exchange", {
      component: "AuthCallback",
      action: "exchangeCode",
      metadata: {
        codeLength: code.length,
        origin: url.origin,
      },
    });

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

      if (exchangeError.message.includes("expired") || exchangeError.code === "otp_expired") {
        loginUrl.searchParams.set("message", "This link has expired. Request a new sign-in link.");
      } else if (exchangeError.message.includes("already used") || exchangeError.code === "otp_disabled") {
        loginUrl.searchParams.set("message", "This link was already used. Request a new one.");
      } else if (exchangeError.message.includes("Email link is invalid") || exchangeError.code === "bad_oauth_state") {
        loginUrl.searchParams.set("message", "This link is invalid. Request a new sign-in link.");
      } else if (exchangeError.status === 422) {
        loginUrl.searchParams.set("message", "Use the complete link from the email.");
      } else {
        loginUrl.searchParams.set("message", `Sign in failed: ${exchangeError.message}`);
      }

      return NextResponse.redirect(loginUrl);
    }

    if (!data.session) {
      logger.error("Auth callback no session created", {
        component: "AuthCallback",
        action: "verifySession",
      });
      const loginUrl = new URL("/login", url.origin);
      loginUrl.searchParams.set("error", "no_session");
      loginUrl.searchParams.set("message", "Could not create a session.");
      return NextResponse.redirect(loginUrl);
    }

    if (data.user?.app_metadata?.provider === "itsme") {
      try {
        const itsmeKycLevel =
          data.user.user_metadata?.kyc_level || data.user.app_metadata?.kyc_level || "basic";

        // F10: Extract the itsme sub (OIDC subject identifier).
        // Stable per human identity; used to enforce one-person-one-account.
        // Primary source: identities array (set by Supabase from OIDC id_token).
        // Fallback: user_metadata.sub (Supabase copies OIDC claims there).
        const itsmeSub: string | null =
          data.user.identities?.find((i) => i.provider === "itsme")?.id ??
          (data.user.user_metadata?.sub as string | undefined) ??
          null;

        if (!itsmeSub) {
          logger.error("itsme callback: sub claim absent from user data", {
            component: "AuthCallback",
            action: "updateItsmeProfile",
            metadata: { userId: data.user.id },
          });
        }

        // itsme_verified and itsme_kyc_level are trust columns restricted to service-role
        // after the lock_profiles_columns migration — use the service-role client here.
        const svc = await supabaseService();

        // itsme_sub is a new column (migration 20260628110000); not yet in generated
        // DB types. The intersection adds it temporarily — remove after pnpm gen:types.
        type ItsmeProfileUpdate = TablesUpdate<"profiles"> & { itsme_sub?: string };
        const updatePayload: ItsmeProfileUpdate = {
          itsme_verified: true,
          itsme_kyc_level: itsmeKycLevel,
        };
        if (itsmeSub) {
          updatePayload.itsme_sub = itsmeSub;
        }

        const { error: profileError } = await svc
          .from("profiles")
          .update(updatePayload)
          .eq("id", data.user.id);

        if (profileError) {
          // F10: Hard-reject identity collision.
          // Another account already has this itsme_sub — someone tried to link the same
          // itsme identity to two different accounts (link-ATO attempt or data error).
          const isSubCollision =
            profileError.code === "23505" &&
            (profileError.message.includes("profiles_itsme_sub_key") ||
              profileError.message.includes("itsme_sub"));

          if (isSubCollision) {
            logger.error("itsme_sub collision: identity already linked to another account", {
              component: "AuthCallback",
              action: "updateItsmeProfile",
              metadata: { userId: data.user.id },
            });

            // Force-sign-out this session so the attacker cannot use it.
            try {
              await svc.auth.admin.signOut(data.user.id, "global");
            } catch (signOutError) {
              logger.error("Failed to sign out after itsme_sub collision", {
                component: "AuthCallback",
                action: "signOutOnCollision",
                error: signOutError,
              });
            }

            const errorUrl = new URL("/login", url.origin);
            errorUrl.searchParams.set("error", "identity_conflict");
            errorUrl.searchParams.set(
              "message",
              "This itsme identity is already associated with a different account. Contact support if this is unexpected.",
            );
            return NextResponse.redirect(errorUrl);
          }

          logger.error("Failed to update profile with Itsme verification", {
            component: "AuthCallback",
            action: "updateItsmeProfile",
            metadata: {
              userId: data.user.id,
              error: profileError,
            },
          });
        } else {
          logger.info("Profile updated with Itsme verification", {
            component: "AuthCallback",
            action: "updateItsmeProfile",
            metadata: {
              userId: data.user.id,
              kycLevel: itsmeKycLevel,
              subPresent: !!itsmeSub,
            },
          });
        }
      } catch (profileUpdateError) {
        logger.error("Exception updating Itsme profile", {
          component: "AuthCallback",
          action: "updateItsmeProfile",
          error: profileUpdateError,
        });
      }
    }

    logger.info("Auth callback successful", {
      component: "AuthCallback",
      action: "success",
      metadata: {
        userId: data.user?.id,
        email: data.user?.email,
        provider: data.user?.app_metadata?.provider,
        next,
      },
    });

    const redirectUrl = new URL(next, url.origin);
    const response = NextResponse.redirect(redirectUrl);

    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });

    return response;
  } catch (callbackError) {
    logger.fatal("Auth callback unexpected error", {
      component: "AuthCallback",
      action: "handleException",
      error: callbackError,
    });

    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set("error", "internal_error");
    loginUrl.searchParams.set("message", "An unexpected error occurred. Try again.");
    return NextResponse.redirect(loginUrl);
  }
}
