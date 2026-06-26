"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { FaFacebook, FaGoogle } from "react-icons/fa";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { localeLabels, registerMessages } from "./messages";
import { supportedLocales, type Locale } from "@/lib/i18n";
import { useDebounce } from "@/hooks/useDebounce";
import { supabase } from "@/lib/supabaseClient";
import { logger } from "@/lib/errorLogger";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function passwordValidity(password: string) {
  const lengthOk = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const classes = [hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;
  return lengthOk && classes >= 3;
}

type FormValues = {
  email: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
  privacy: boolean;
  marketing: boolean;
};

type Props = {
  initialLocale: Locale;
};

export default function RegisterForm({ initialLocale }: Props) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const messages = useMemo(() => registerMessages[locale], [locale]);
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    clearErrors,
    watch,
  } = useForm<FormValues>({
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      terms: false,
      privacy: false,
      marketing: false,
    },
  });

  const [submitting, setSubmitting] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [socialLoading, setSocialLoading] = useState(false);

  const emailValue = watch("email");
  const debouncedEmail = useDebounce(emailValue, 500);

  useEffect(() => {
    async function checkEmailAvailability() {
      if (!debouncedEmail || !emailPattern.test(debouncedEmail)) {
        setEmailAvailable(null);
        return;
      }

      setCheckingEmail(true);
      try {
        const response = await fetch(`/api/auth/check-email?email=${encodeURIComponent(debouncedEmail)}`);
        const data = await response.json();

        if (data.ok) {
          setEmailAvailable(data.available);
          if (!data.available) {
            setError("email", {
              type: "manual",
              message: messages.errorEmailInUse,
            });
          } else {
            clearErrors("email");
          }
        } else {
          setEmailAvailable(null);
        }
      } catch (error) {
        logger.warn("Failed to check email availability", {
          component: "RegisterForm",
          action: "checkEmailAvailability",
          error,
        });
        setEmailAvailable(null);
      } finally {
        setCheckingEmail(false);
      }
    }

    checkEmailAvailability();
  }, [debouncedEmail, messages.errorEmailInUse, setError, clearErrors]);

  const handleSocialRegister = async (provider: "google" | "facebook") => {
    setSocialLoading(true);
    try {
      const redirectUrl = new URL("/auth/callback", window.location.origin);
      const next = searchParams.get("next") ?? "/onboarding";
      redirectUrl.searchParams.set("next", next);

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl.toString(),
        },
      });

      if (error) {
        toast.error(`Could not continue with ${provider}.`);
        logger.error("Social register failed", {
          component: "RegisterForm",
          action: "handleSocialRegister",
          metadata: { provider },
          error,
        });
      }
    } catch (error) {
      logger.error("Social register exception", {
        component: "RegisterForm",
        action: "handleSocialRegister",
        metadata: { provider },
        error,
      });
      toast.error("Could not reach the server.");
    } finally {
      setSocialLoading(false);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!emailPattern.test(values.email)) {
      setError("email", { type: "manual", message: messages.emailError });
      toast.error(messages.emailError);
      return;
    }

    if (!passwordValidity(values.password)) {
      setError("password", { type: "manual", message: messages.passwordError });
      toast.error(messages.passwordError);
      return;
    }

    if (values.password !== values.confirmPassword) {
      setError("confirmPassword", { type: "manual", message: messages.confirmPasswordError });
      toast.error(messages.confirmPasswordError);
      return;
    }

    if (!values.terms || !values.privacy) {
      setError("terms", { type: "manual", message: messages.consentsError });
      setError("privacy", { type: "manual", message: messages.consentsError });
      // Surface this — the consent checkboxes sit below the fold on mobile, so an inline-only
      // error looked like "nothing happened" after pressing submit.
      toast.error(messages.consentsError);
      return;
    }

    setSubmitting(true);
    clearErrors(["email", "password", "confirmPassword", "terms", "privacy"]);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          confirmPassword: values.confirmPassword,
          consents: {
            terms: values.terms,
            privacy: values.privacy,
            marketing: values.marketing,
          },
          locale,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        const errorCode = payload?.error ?? "GENERIC";
        let errorMessage = messages.errorGeneric;
        if (errorCode === "EMAIL_IN_USE") errorMessage = messages.errorEmailInUse;
        else if (errorCode === "WEAK_PASSWORD") errorMessage = messages.errorWeakPassword;
        else if (errorCode === "CONSENT_REQUIRED") {
          errorMessage = messages.consentsError;
          setError("terms", { type: "manual", message: messages.consentsError });
          setError("privacy", { type: "manual", message: messages.consentsError });
        } else if (errorCode === "INVALID_EMAIL") {
          errorMessage = messages.emailError;
          setError("email", { type: "manual", message: messages.emailError });
        } else if (errorCode === "SERVICE_ROLE_MISSING") {
          errorMessage = messages.errorService;
        }
        toast.error(errorMessage);
        return;
      }

      toast.success(messages.successTitle, {
        description: messages.successBody,
      });
      router.push(`/onboarding?lang=${locale}`);
    } catch {
      toast.error(messages.errorService);
    } finally {
      setSubmitting(false);
    }
  });

  const loginHref = searchParams.get("next")
    ? `/login?next=${encodeURIComponent(searchParams.get("next") ?? "")}`
    : "/login";

  return (
    <Card className="w-full rounded-2xl border border-border/70 shadow-[var(--shadow-card)]">
      <CardHeader className="gap-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-2.5">
          <div className="inline-flex items-center gap-2 rounded-full lyvox-trust-gradient px-3 py-1 text-xs font-semibold text-white shadow-[var(--shadow-soft)]">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {messages.trustedSetup}
          </div>
          <CardTitle className="text-2xl font-extrabold tracking-tight">{messages.title}</CardTitle>
          <CardDescription className="max-w-xl">{messages.intro}</CardDescription>
        </div>
        <label className="text-sm text-muted-foreground">
          <span className="block text-xs font-medium uppercase tracking-wide">{messages.languageLabel}</span>
          <select
            className="mt-1 h-10 w-full min-w-36 rounded-xl border border-border bg-background px-3 text-sm text-foreground shadow-[var(--shadow-soft)] focus:outline-none focus:ring-4 focus:ring-primary/12 sm:w-36"
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
          >
            {supportedLocales.map((code) => (
              <option key={code} value={code}>
                {localeLabels[code]}
              </option>
            ))}
          </select>
        </label>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl shadow-[var(--shadow-soft)]"
            onClick={() => handleSocialRegister("google")}
            disabled={socialLoading || submitting}
          >
            <FaGoogle className="size-4" />
            {messages.socialGoogle}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl shadow-[var(--shadow-soft)]"
            onClick={() => handleSocialRegister("facebook")}
            disabled={socialLoading || submitting}
          >
            <FaFacebook className="size-4" />
            {messages.socialFacebook}
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">{messages.dividerLabel}</span>
          </div>
        </div>

        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="email">
              {messages.emailLabel}
            </label>
            <div className="relative">
              <Input
                id="email"
                type="email"
                placeholder={messages.emailPlaceholder}
                autoComplete="email"
                {...register("email", { required: messages.emailError })}
                className={
                  emailAvailable === false
                    ? "rounded-xl border-destructive pr-28 focus-visible:ring-4 focus-visible:ring-destructive/20"
                    : emailAvailable === true
                      ? "rounded-xl border-primary pr-28 focus-visible:ring-4 focus-visible:ring-primary/12"
                      : "rounded-xl pr-28 focus-visible:ring-4 focus-visible:ring-primary/12"
                }
              />
              {checkingEmail && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {messages.checkingEmail}
                </span>
              )}
              {!checkingEmail && emailAvailable === true && (
                <span className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 text-xs font-medium text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {messages.emailAvailable}
                </span>
              )}
            </div>
            {errors.email?.message ? <p className="text-sm text-destructive">{String(errors.email.message)}</p> : null}
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="password">
              {messages.passwordLabel}
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register("password", { required: messages.passwordError })}
              className="rounded-xl focus-visible:ring-4 focus-visible:ring-primary/12"
            />
            <div className="rounded-xl border border-border/70 bg-muted/40 p-3.5 shadow-[var(--shadow-soft)]">
              <p className="text-sm text-muted-foreground">{messages.passwordHint}</p>
              <ul className="mt-2 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
                {messages.passwordChecklist.map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            {errors.password?.message ? <p className="text-sm text-destructive">{String(errors.password.message)}</p> : null}
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="confirmPassword">
              {messages.confirmPasswordLabel}
            </label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register("confirmPassword", { required: messages.confirmPasswordError })}
              className="rounded-xl focus-visible:ring-4 focus-visible:ring-primary/12"
            />
            {errors.confirmPassword?.message ? (
              <p className="text-sm text-destructive">{String(errors.confirmPassword.message)}</p>
            ) : null}
          </div>

          <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/30 p-4 shadow-[var(--shadow-soft)]">
            <span className="text-sm font-semibold text-foreground">{messages.consentsTitle}</span>
            <label className="flex items-start gap-3 text-sm text-muted-foreground">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-primary" {...register("terms")} />
              <span>
                {messages.consents.terms} (
                <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/legal/terms" target="_blank">
                  {messages.legalLinkLabel}
                </Link>
                )
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-muted-foreground">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-primary" {...register("privacy")} />
              <span>
                {messages.consents.privacy} (
                <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/legal/privacy" target="_blank">
                  {messages.legalLinkLabel}
                </Link>
                )
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-muted-foreground">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-primary" {...register("marketing")} />
              <span>{messages.consents.marketing}</span>
            </label>
            {(errors.terms?.message || errors.privacy?.message) && (
              <p className="text-sm text-destructive">{messages.consentsError}</p>
            )}
          </div>

          <Button type="submit" disabled={submitting} className="h-11 rounded-xl lyvox-cta-gradient text-primary-foreground shadow-[var(--shadow-card)]">
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {messages.submit}...
              </>
            ) : (
              messages.submit
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center border-t border-border/70 pt-5 text-sm text-muted-foreground">
        {messages.loginPrompt}{" "}
        <Link href={loginHref} className="ml-1 font-medium text-primary underline-offset-4 hover:underline">
          {messages.loginLink}
        </Link>
      </CardFooter>
    </Card>
  );
}
