"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FaFacebook, FaGoogle } from "react-icons/fa";
import { ArrowLeft, CheckCircle2, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { logger } from "@/lib/errorLogger";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/i18n";
import TurnstileWidget, { type TurnstileWidgetHandle } from "@/components/antifraud/TurnstileWidget";
import { verifyCaptcha } from "@/lib/antifraud/verifyCaptchaClient";

// PERF-07 item 2: /login was the sole consumer of the zod `loginSchema`, which
// dragged the whole zod runtime into this route's first-load JS for a single
// email check. Inline the exact same validation (trim → lowercase → non-empty →
// email regex, identical messages) so zod no longer ships to /login — the same
// zod-free email check RegisterForm already uses. The return shape mirrors
// zod's `safeParse` result so every call site below is untouched.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type EmailParseResult =
  | { success: true; data: { email: string } }
  | { success: false; error: { issues: [{ message: string }] } };

function parseLoginEmail(rawEmail: string): EmailParseResult {
  const email = rawEmail.trim().toLowerCase();
  if (email.length < 1) {
    return { success: false, error: { issues: [{ message: "Enter your email address." }] } };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return {
      success: false,
      error: { issues: [{ message: "Enter a valid email address, for example user@example.com." }] },
    };
  }
  return { success: true, data: { email } };
}

function LoginPageInner() {
  const { t } = useI18n();
  const tr = (k: string, fb: string) => {
    const v = t(k);
    return v === k ? fb : v;
  };
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [activeTab, setActiveTab] = useState<"password" | "magic-link">("password");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const callbackError = searchParams.get("error");
  const callbackMessage = searchParams.get("message");

  useEffect(() => {
    if (callbackError && callbackMessage) {
      toast.error(callbackMessage, { id: callbackError });
    }
  }, [callbackError, callbackMessage]);

  useEffect(() => {
    if (!touched || !email) {
      setValidationError(null);
      return;
    }

    const validationResult = parseLoginEmail(email);
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      setValidationError(firstError.message);
    } else {
      setValidationError(null);
    }
  }, [email, touched]);

  const handlePasswordLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setValidationError(null);

    try {
      const validationResult = parseLoginEmail(email);

      if (!validationResult.success) {
        const firstError = validationResult.error.issues[0];
        setValidationError(firstError.message);
        toast.error(firstError.message);
        return;
      }

      if (!password || password.length < 8) {
        const message = tr("auth.errorPasswordMinLength", "Password must contain at least 8 characters.");
        setValidationError(message);
        toast.error(message);
        return;
      }

      const captchaOk = await verifyCaptcha(turnstileToken);
      // Turnstile tokens are single-use — reset now so the next attempt (success
      // or failure) always gets a fresh token instead of a spent one.
      turnstileRef.current?.reset();
      if (!captchaOk) {
        toast.error(tr("auth.captchaError", "Captcha verification failed. Try again."));
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: validationResult.data.email,
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error(tr("auth.errorIncorrectCredentials", "The email or password is incorrect."));
        } else if (error.message.includes("Email not confirmed")) {
          toast.error(tr("auth.errorConfirmEmail", "Confirm your email before signing in."));
        } else if (error.message.includes("Too many requests")) {
          toast.error(tr("auth.errorTooManyAttempts", "Too many attempts. Try again later."));
        } else {
          toast.error(tr("auth.errorSignInFailed", "Sign in failed. Try again later."));
        }
        logger.error("Password login failed", {
          component: "LoginPage",
          action: "handlePasswordLogin",
          metadata: {
            code: error.status,
            email: validationResult.data.email,
          },
          error,
        });
      } else if (data.session) {
        toast.success(tr("auth.signedInSuccess", "Signed in successfully."));
        const next = searchParams.get("next") ?? "/profile";
        router.push(next);
      }
    } catch (error) {
      logger.error("Password login exception", {
        component: "LoginPage",
        action: "handlePasswordLogin",
        error,
      });
      toast.error(tr("auth.errorConnection", "Could not reach the server. Check your internet connection."));
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLinkLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setValidationError(null);

    try {
      const validationResult = parseLoginEmail(email);

      if (!validationResult.success) {
        const firstError = validationResult.error.issues[0];
        setValidationError(firstError.message);
        toast.error(firstError.message);
        return;
      }

      const captchaOk = await verifyCaptcha(turnstileToken);
      turnstileRef.current?.reset();
      if (!captchaOk) {
        toast.error(tr("auth.captchaError", "Captcha verification failed. Try again."));
        return;
      }

      const redirectUrl = new URL("/auth/callback", window.location.origin);
      const next = searchParams.get("next") ?? "/profile";
      redirectUrl.searchParams.set("next", next);

      const { error } = await supabase.auth.signInWithOtp({
        email: validationResult.data.email,
        options: {
          emailRedirectTo: redirectUrl.toString(),
          shouldCreateUser: false,
          data: {
            rememberDevice,
          },
        },
      });

      if (error) {
        if (error.message.includes("Email not confirmed")) {
          toast.error(tr("auth.errorConfirmEmail", "Confirm your email before signing in."));
        } else if (error.message.includes("Invalid email")) {
          toast.error(tr("auth.errorInvalidEmail", "Enter a valid email address."));
        } else if (error.message.includes("Too many requests")) {
          toast.error(tr("auth.errorTooManyAttempts", "Too many attempts. Try again later."));
        } else if (error.message.includes("User not found")) {
          toast.error(tr("auth.errorNoAccount", "No account found for this email. Create an account first."));
        } else {
          toast.error(tr("auth.errorSignInFailed", "Sign in failed. Try again later."));
        }
        logger.error("Magic link login failed", {
          component: "LoginPage",
          action: "handleMagicLinkLogin",
          metadata: {
            code: error.status,
            email: validationResult.data.email,
          },
          error,
        });
      } else {
        toast.success(tr("auth.magicLinkSent", "Sign-in link sent. Check your email."));
      }
    } catch (error) {
      logger.error("Magic link login exception", {
        component: "LoginPage",
        action: "handleMagicLinkLogin",
        error,
      });
      toast.error(tr("auth.errorConnection", "Could not reach the server. Check your internet connection."));
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: "google" | "facebook") => {
    setLoading(true);
    try {
      const redirectUrl = new URL("/auth/callback", window.location.origin);
      const next = searchParams.get("next") ?? "/profile";
      redirectUrl.searchParams.set("next", next);

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl.toString(),
        },
      });

      if (error) {
        toast.error(tr("auth.errorSocialProvider", "Could not continue with {provider}.").replace("{provider}", provider));
        logger.error("Social login failed", {
          component: "LoginPage",
          action: "handleSocialLogin",
          metadata: { provider },
          error,
        });
      }
    } catch (error) {
      logger.error("Social login exception", {
        component: "LoginPage",
        action: "handleSocialLogin",
        metadata: { provider },
        error,
      });
      toast.error(tr("auth.errorConnectionShort", "Could not reach the server."));
    } finally {
      setLoading(false);
    }
  };

  const next = searchParams.get("next");
  const registerHref = next ? `/register?next=${encodeURIComponent(next)}` : "/register";

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 md:grid-cols-[minmax(0,1fr)_440px] md:py-16">
        <section className="flex flex-col justify-center gap-6">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {tr("auth.backToMarketplace", "Back to marketplace")}
          </Link>

          <div className="max-w-xl space-y-4">
            <div className="lyvox-trust-gradient inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold text-white">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {tr("auth.protectedAccess", "Protected account access")}
            </div>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-foreground md:text-4xl">
              {tr("auth.heroHeading", "Sign in to manage listings, messages, and trusted payments.")}
            </h1>
            <p className="text-base leading-7 text-muted-foreground">
              {tr(
                "auth.heroSubtitle",
                "Use password, magic link, or OAuth. We keep account actions clear and route you back to the exact marketplace task you started.",
              )}
            </p>
          </div>

          <div className="grid max-w-xl gap-3 sm:grid-cols-3">
            {[
              { key: "auth.featureSellerTools", fb: "Verified seller tools" },
              { key: "auth.featureSavedListings", fb: "Saved listings" },
              { key: "auth.featureSecureMessages", fb: "Secure messages" },
            ].map((item) => (
              <div key={item.key} className="flex items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2.5 text-sm font-medium shadow-[var(--shadow-soft)]">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{tr(item.key, item.fb)}</span>
              </div>
            ))}
          </div>
        </section>

        <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-2xl">{tr("auth.cardTitle", "Sign in")}</CardTitle>
            <CardDescription>{tr("auth.cardDescription", "Choose the fastest option available for your account.")}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => handleSocialLogin("google")}
                disabled={loading}
              >
                <FaGoogle className="size-4" />
                Google
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => handleSocialLogin("facebook")}
                disabled={loading}
              >
                <FaFacebook className="size-4" />
                Facebook
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">{tr("auth.orContinueWith", "or continue with")}</span>
              </div>
            </div>

            <TurnstileWidget ref={turnstileRef} onToken={setTurnstileToken} />

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "password" | "magic-link")}>
              <TabsList className="grid h-10 w-full grid-cols-2 rounded-xl">
                <TabsTrigger value="password">
                  <Lock className="size-4" />
                  {tr("auth.tabPassword", "Password")}
                </TabsTrigger>
                <TabsTrigger value="magic-link">
                  <Mail className="size-4" />
                  {tr("auth.tabMagicLink", "Magic link")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="password" className="pt-4">
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-password">{tr("auth.emailLabel", "Email address")}</Label>
                    <Input
                      id="email-password"
                      type="email"
                      placeholder={tr("auth.emailPlaceholder", "you@example.com")}
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                      }}
                      onBlur={() => setTouched(true)}
                      required
                      disabled={loading}
                      aria-invalid={!!validationError}
                      aria-describedby={validationError ? "email-error" : undefined}
                    />
                    {validationError && (
                      <p id="email-error" className="text-sm text-destructive">
                        {validationError}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">{tr("auth.passwordLabel", "Password")}</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder={tr("auth.passwordPlaceholder", "Enter your password")}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      disabled={loading}
                      minLength={8}
                    />
                  </div>

                  <Button type="submit" disabled={loading || !!validationError} className="h-11 w-full">
                    {loading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {tr("auth.signingIn", "Signing in...")}
                      </>
                    ) : (
                      tr("auth.signInButton", "Sign in")
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="magic-link" className="pt-4">
                <form onSubmit={handleMagicLinkLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-magic">{tr("auth.emailLabel", "Email address")}</Label>
                    <Input
                      id="email-magic"
                      type="email"
                      placeholder={tr("auth.emailPlaceholder", "you@example.com")}
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                      }}
                      onBlur={() => setTouched(true)}
                      required
                      disabled={loading}
                      aria-invalid={!!validationError}
                      aria-describedby={validationError ? "email-error-magic" : undefined}
                    />
                    {validationError && (
                      <p id="email-error-magic" className="text-sm text-destructive">
                        {validationError}
                      </p>
                    )}
                  </div>

                  <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/40 p-3">
                    <Checkbox
                      id="remember-device"
                      checked={rememberDevice}
                      onCheckedChange={(checked) => setRememberDevice(checked === true)}
                      disabled={loading}
                    />
                    <label htmlFor="remember-device" className="text-sm leading-5 text-muted-foreground">
                      {tr("auth.rememberDevice", "Remember this device for 30 days after the email link sign-in.")}
                    </label>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || !!validationError}
                    variant="outline"
                    className="h-11 w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {tr("auth.sendingLink", "Sending link...")}
                      </>
                    ) : (
                      tr("auth.sendMagicLink", "Send sign-in link")
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="space-y-2 border-t border-border pt-4 text-center text-sm">
              <p className="text-muted-foreground">
                {tr("auth.newToLyvox", "New to LyVoX?")}{" "}
                <Link href={registerHref} className="font-medium text-primary underline-offset-4 hover:underline">
                  {tr("auth.createAccount", "Create an account")}
                </Link>
              </p>
              <p className="text-muted-foreground">
                {tr("auth.forgotPassword", "Forgot your password?")}{" "}
                <Link href="/auth/recovery" className="font-medium text-primary underline-offset-4 hover:underline">
                  {tr("auth.recoverAccess", "Recover access")}
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function LoginFallback() {
  const { t } = useI18n();
  const tr = (k: string, fb: string) => {
    const v = t(k);
    return v === k ? fb : v;
  };
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center text-sm text-muted-foreground">
      {tr("auth.loadingSignIn", "Loading sign-in...")}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageInner />
    </Suspense>
  );
}
