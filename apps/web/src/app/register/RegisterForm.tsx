"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { FaFacebook, FaGoogle } from "react-icons/fa";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { localeLabels, registerMessages } from "./messages";
import { localizeHref, supportedLocales, type Locale } from "@/lib/i18n";
import { useDebounce } from "@/hooks/useDebounce";
import { supabase } from "@/lib/supabaseClient";
import { logger } from "@/lib/errorLogger";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset?: (id?: string) => void;
    };
  }
}

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

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

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
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

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

  // Render Turnstile widget after script loads (explicit-render mode).
  // The effect runs unconditionally; the guard inside keeps logic off when not configured.
  useEffect(() => {
    if (!siteKey || !scriptLoaded || !turnstileRef.current) return;
    if (widgetIdRef.current) return; // already rendered — guard against StrictMode double-effect

    widgetIdRef.current = window.turnstile?.render(turnstileRef.current, {
      sitekey: siteKey,
      callback: (token: string) => setTurnstileToken(token),
      "error-callback": () => setTurnstileToken(null),
      "expired-callback": () => setTurnstileToken(null),
    }) ?? null;
  }, [scriptLoaded]);

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
          turnstileToken: turnstileToken ?? undefined,
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
        } else if (errorCode === "DISPOSABLE_EMAIL") {
          errorMessage = messages.disposableEmailError;
          setError("email", { type: "manual", message: messages.disposableEmailError });
        } else if (errorCode === "CAPTCHA_FAILED" || errorCode === "CAPTCHA_REQUIRED") {
          errorMessage = messages.captchaError;
        } else if (payload?.detail) {
          // Surface the real reason (e.g. a password the auth server rejected as weak/breached, or a
          // rate limit) instead of a vague generic message the user can't act on.
          errorMessage = payload.detail;
        }
        toast.error(errorMessage);
        // Turnstile tokens are single-use: the server consumes the token during
        // `verifyTurnstile`, so any failure after that check (e.g. EMAIL_IN_USE,
        // WEAK_PASSWORD, profile-upsert error) leaves a spent token in state.
        // Re-submitting with the same spent token → 403 CAPTCHA_FAILED, wedging
        // the user until the token expires (~5 min) or a full page reload.
        // Reset the widget now so the next attempt gets a fresh token.
        window.turnstile?.reset?.(widgetIdRef.current ?? undefined);
        setTurnstileToken(null);
        return;
      }

      toast.success(messages.successTitle, {
        description: messages.successBody,
      });
      router.push(localizeHref("/onboarding", locale));
    } catch {
      toast.error(messages.errorService);
    } finally {
      setSubmitting(false);
    }
  });

  const loginHref = searchParams.get("next")
    ? localizeHref(`/login?next=${encodeURIComponent(searchParams.get("next") ?? "")}`, locale)
    : localizeHref("/login", locale);

  return (
    <div className="overflow-hidden rounded-[var(--r)] border border-border/70 shadow-[var(--shadow-card)] md:grid md:grid-cols-[1fr_1.05fr]">
      {siteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          async
          defer
          onLoad={() => setScriptLoaded(true)}
        />
      )}

      {/* ── LEFT: trust-gradient hero ─────────────────────────────────── */}
      <div className="lyvox-cta-gradient relative flex flex-col justify-between overflow-hidden px-8 py-10 text-white md:px-10 md:py-11">
        {/* decorative radial blobs */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(50% 45% at 20% 12%, oklch(0.92 0.10 168 / 0.5), transparent 70%), radial-gradient(50% 50% at 90% 95%, oklch(0.70 0.13 200 / 0.45), transparent 70%)",
          }}
          aria-hidden="true"
        />

        {/* top: logo + headline */}
        <div className="relative">
          <span className="mb-10 flex items-center gap-2.5 text-[23px] font-extrabold tracking-tight">
            <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl bg-white/[0.18] backdrop-blur-sm">
              <ShieldCheck className="h-[21px] w-[21px] stroke-white" aria-hidden="true" />
            </span>
            LyVoX
          </span>
          <h1 className="mb-3.5 max-w-[13ch] text-[30px] font-extrabold leading-[1.2] tracking-tight">
            {messages.heroHeadline}
          </h1>
          <p className="max-w-[34ch] text-[14.5px] leading-[1.6] opacity-[0.92]">
            {messages.heroSubtext}
          </p>
        </div>

        {/* bottom: trust signals */}
        <div className="relative mt-10 flex flex-col gap-3.5 md:mt-0">
          {/* signal 1: identity-verified sellers */}
          <div className="flex items-center gap-2.5">
            <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-white/[0.16]">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="white" strokeWidth="2.2" aria-hidden="true">
                <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </span>
            <span className="text-[13.5px] font-semibold">{messages.heroSignal1}</span>
          </div>
          {/* signal 2: private & business labels */}
          <div className="flex items-center gap-2.5">
            <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-white/[0.16]">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="white" strokeWidth="2.2" aria-hidden="true">
                <path d="M3 7h18v13H3zM3 7l3-4h12l3 4M9 12h6" />
              </svg>
            </span>
            <span className="text-[13.5px] font-semibold">{messages.heroSignal2}</span>
          </div>
          {/* signal 3: human dispute support */}
          <div className="flex items-center gap-2.5">
            <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-white/[0.16]">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="white" strokeWidth="2.2" aria-hidden="true">
                <path d="M8 10h8M8 14h5" />
                <path d="M21 12a9 9 0 11-3.5-7.1L21 3v6h-6" />
              </svg>
            </span>
            <span className="text-[13.5px] font-semibold">{messages.heroSignal3}</span>
          </div>
        </div>
      </div>

      {/* ── RIGHT: form column ────────────────────────────────────────── */}
      <div className="bg-card px-8 py-10 md:px-10 md:py-11">
        {/* segmented Register / Log in tab */}
        <div className="mb-6 inline-flex gap-[3px] rounded-full bg-muted p-1">
          <span
            aria-current="page"
            className="inline-flex h-[34px] items-center rounded-full bg-card px-5 text-[13px] font-bold text-foreground shadow-[var(--shS)]"
          >
            {messages.tabRegister}
          </span>
          <Link
            href={loginHref}
            className="inline-flex h-[34px] items-center rounded-full px-5 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            {messages.tabLogin}
          </Link>
        </div>

        {/* form heading */}
        <h2 className="mb-1 text-[22px] font-extrabold tracking-tight">{messages.title}</h2>
        <p className="mb-6 text-[13px] font-medium text-muted-foreground">{messages.formSubtitle}</p>

        {/* language selector */}
        <div className="mb-5">
          <label className="text-sm text-muted-foreground">
            <span className="block text-xs font-medium uppercase tracking-wide">{messages.languageLabel}</span>
            <select
              className="mt-1 h-10 w-full min-w-36 rounded-[var(--rm)] border border-border bg-background px-3 text-sm text-foreground shadow-[var(--shS)] focus:outline-none focus:ring-4 focus:ring-primary/12 sm:w-40"
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
        </div>

        {/* social OAuth */}
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-[var(--rm)] shadow-[var(--shS)]"
            onClick={() => handleSocialRegister("google")}
            disabled={socialLoading || submitting}
          >
            <FaGoogle className="size-4" />
            {messages.socialGoogle}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-[var(--rm)] shadow-[var(--shS)]"
            onClick={() => handleSocialRegister("facebook")}
            disabled={socialLoading || submitting}
          >
            <FaFacebook className="size-4" />
            {messages.socialFacebook}
          </Button>
        </div>

        {/* divider */}
        <div className="relative mb-5">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">{messages.dividerLabel}</span>
          </div>
        </div>

        {/* email/password/consents form */}
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          {/* email */}
          <div className="grid gap-2">
            <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="email">
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
                    ? "h-[46px] rounded-[var(--rm)] border-destructive pr-28 focus-visible:ring-4 focus-visible:ring-destructive/20"
                    : emailAvailable === true
                      ? "h-[46px] rounded-[var(--rm)] border-primary pr-28 focus-visible:ring-4 focus-visible:ring-primary/12"
                      : "h-[46px] rounded-[var(--rm)] pr-28 focus-visible:ring-4 focus-visible:ring-primary/12"
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

          {/* password */}
          <div className="grid gap-2">
            <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="password">
              {messages.passwordLabel}
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register("password", { required: messages.passwordError })}
              className="h-[46px] rounded-[var(--rm)] focus-visible:ring-4 focus-visible:ring-primary/12"
            />
            <div className="rounded-[var(--rm)] border border-border/70 bg-muted/40 p-3.5 shadow-[var(--shS)]">
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

          {/* confirm password */}
          <div className="grid gap-2">
            <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="confirmPassword">
              {messages.confirmPasswordLabel}
            </label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register("confirmPassword", { required: messages.confirmPasswordError })}
              className="h-[46px] rounded-[var(--rm)] focus-visible:ring-4 focus-visible:ring-primary/12"
            />
            {errors.confirmPassword?.message ? (
              <p className="text-sm text-destructive">{String(errors.confirmPassword.message)}</p>
            ) : null}
          </div>

          {/* consents — terms + privacy + marketing in exact DOM order (test-critical) */}
          <div className="grid gap-3 rounded-[var(--rm)] border border-border/70 bg-muted/30 p-4 shadow-[var(--shS)]">
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

          {/* Turnstile — only renders when siteKey is configured (do NOT render a fake box) */}
          {siteKey && <div ref={turnstileRef} />}

          {/* CTA — text-white is correct: gradient is dark-teal in both themes */}
          <Button
            type="submit"
            disabled={submitting}
            className="h-[50px] rounded-[var(--rm)] lyvox-cta-gradient text-white shadow-[0_5px_16px_oklch(0.55_0.13_178_/_0.38)] mt-0.5"
          >
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

        {/* footer login link */}
        <p className="mt-5 text-center text-[12.5px] text-muted-foreground">
          {messages.loginPrompt}{" "}
          <Link href={loginHref} className="font-semibold text-primary underline-offset-4 hover:underline">
            {messages.loginLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
