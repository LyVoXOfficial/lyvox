"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { supportedLocales, type Locale, defaultLocale } from "@/lib/i18n";

type Messages = Record<string, any>;

// Client-only provider; server helpers live in ./server

type TFunction = (key: string, params?: Record<string, string | number>) => string;
type Ctx = { locale: Locale; messages: Messages; t: TFunction };
const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  const value = useMemo<Ctx>(() => {
    const t: TFunction = (key: string, params?: Record<string, string | number>) => {
      const translation = key.split(".").reduce<any>((acc, part) => (acc ? acc[part] : undefined), messages) ?? key;
      
      // Always ensure we return a string
      let result: string;
      if (typeof translation !== "string") {
        result = String(translation ?? key);
      } else {
        result = translation;
      }
      
      // Replace {variable} placeholders with actual values if params provided
      if (params) {
        result = result.replace(/\{(\w+)\}/g, (match, varName) => {
          return params[varName] !== undefined ? String(params[varName]) : match;
        });
      }
      
      return result;
    };
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
