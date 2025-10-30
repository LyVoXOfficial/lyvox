import { cookies, headers } from "next/headers";
import { resolveFromAcceptLanguage, resolveLocale, type Locale } from "@/lib/i18n";

type Messages = Record<string, any>;

async function loadMessages(locale: Locale): Promise<Messages> {
  switch (locale) {
    case "en":
      return (await import("./locales/en.json")).default as Messages;
    case "fr":
      return (await import("./locales/fr.json")).default as Messages;
    case "nl":
      return (await import("./locales/nl.json")).default as Messages;
    case "ru":
      return (await import("./locales/ru.json")).default as Messages;
    case "de":
      return (await import("./locales/de.json")).default as Messages;
    default:
      return (await import("./locales/en.json")).default as Messages;
  }
}

export async function getInitialLocale(): Promise<Locale> {
  const c = await cookies();
  const fromCookie = c.get("locale")?.value;
  if (fromCookie) return resolveLocale(fromCookie);
  const h = await headers();
  const accepted = h.get("accept-language");
  return resolveFromAcceptLanguage(accepted);
}

export async function getI18nProps() {
  const locale = await getInitialLocale();
  const messages = await loadMessages(locale);
  return { locale, messages } as const;
}
