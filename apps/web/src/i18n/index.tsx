"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { supportedLocales, type Locale, defaultLocale } from "@/lib/i18n";

type Messages = Record<string, any>;

// Client-only provider; server helpers live in ./server

type Ctx = { locale: Locale; messages: Messages; t: (key: string) => string };
const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  const value = useMemo<Ctx>(() => {
    const t = (key: string) => key.split(".").reduce<any>((acc, part) => (acc ? acc[part] : undefined), messages) ?? key;
    return { locale, messages, t };
  }, [locale, messages]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export { supportedLocales, type Locale, defaultLocale };
