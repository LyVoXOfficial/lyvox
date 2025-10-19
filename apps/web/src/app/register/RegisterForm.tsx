"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { localeLabels, registerMessages } from "./messages";
import { supportedLocales, type Locale } from "@/lib/i18n";

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

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    clearErrors,
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

  const onSubmit = handleSubmit(async (values) => {
    if (!emailPattern.test(values.email)) {
      setError("email", { type: "manual", message: messages.emailError });
      return;
    }

    if (!passwordValidity(values.password)) {
      setError("password", { type: "manual", message: messages.passwordError });
      return;
    }

    if (values.password !== values.confirmPassword) {
      setError("confirmPassword", { type: "manual", message: messages.confirmPasswordError });
      return;
    }

    if (!values.terms || !values.privacy) {
      setError("terms", { type: "manual", message: messages.consentsError });
      setError("privacy", { type: "manual", message: messages.consentsError });
      return;
    }

    setSubmitting(true);
    clearErrors(["email", "password", "confirmPassword", "terms", "privacy"]);

    try {
      const res = await fetch("/api/auth/register", {
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

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.ok) {
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

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <h1 className="text-2xl font-semibold text-zinc-900">{messages.title}</h1>
          <p className="text-sm text-zinc-600">{messages.intro}</p>
        </div>
        <label className="text-right text-sm text-zinc-600">
          <span className="block text-xs uppercase tracking-wide text-zinc-500">{messages.languageLabel}</span>
          <select
            className="mt-1 w-32 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm"
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

      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-800" htmlFor="email">
            {messages.emailLabel}
          </label>
          <Input
            id="email"
            type="email"
            placeholder={messages.emailPlaceholder}
            autoComplete="email"
            {...register("email", { required: messages.emailError })}
          />
          {errors.email?.message ? (
            <p className="text-sm text-rose-600">{String(errors.email.message)}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-800" htmlFor="password">
            {messages.passwordLabel}
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register("password", { required: messages.passwordError })}
          />
          <p className="text-sm text-zinc-600">{messages.passwordHint}</p>
          <ul className="list-disc pl-5 text-sm text-zinc-500">
            {messages.passwordChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {errors.password?.message ? (
            <p className="text-sm text-rose-600">{String(errors.password.message)}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-800" htmlFor="confirmPassword">
            {messages.confirmPasswordLabel}
          </label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...register("confirmPassword", { required: messages.confirmPasswordError })}
          />
          {errors.confirmPassword?.message ? (
            <p className="text-sm text-rose-600">{String(errors.confirmPassword.message)}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-zinc-200 p-4">
          <span className="text-sm font-medium text-zinc-800">{messages.consentsTitle}</span>
          <label className="flex items-start gap-3 text-sm text-zinc-700">
            <input type="checkbox" className="mt-1 h-4 w-4" {...register("terms")} />
            <span>
              {messages.consents.terms} (
              <a className="text-blue-600 underline" href="/legal/terms" target="_blank" rel="noreferrer">
                {messages.legalLinkLabel}
              </a>
              )
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-zinc-700">
            <input type="checkbox" className="mt-1 h-4 w-4" {...register("privacy")} />
            <span>
              {messages.consents.privacy} (
              <a className="text-blue-600 underline" href="/legal/privacy" target="_blank" rel="noreferrer">
                {messages.legalLinkLabel}
              </a>
              )
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-zinc-700">
            <input type="checkbox" className="mt-1 h-4 w-4" {...register("marketing")} />
            <span>{messages.consents.marketing}</span>
          </label>
          {(errors.terms?.message || errors.privacy?.message) && (
            <p className="text-sm text-rose-600">{messages.consentsError}</p>
          )}
        </div>

        <Button type="submit" disabled={submitting}>
          {submitting ? `${messages.submit}...` : messages.submit}
        </Button>
      </form>
    </div>
  );
}
