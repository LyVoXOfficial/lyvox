"use client";

import { useRouter } from "next/navigation";
import { useI18n, supportedLocales, type Locale } from "@/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe } from "lucide-react";

const localeNames: Record<Locale, string> = {
  en: "English",
  ru: "Русский",
  nl: "Nederlands",
  fr: "Français",
  de: "Deutsch",
};

const localeFlags: Record<Locale, string> = {
  en: "🇬🇧",
  ru: "🇷🇺",
  nl: "🇧🇪",
  fr: "🇧🇪",
  de: "🇧🇪",
};

export default function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const router = useRouter();

  const handleLocaleChange = async (newLocale: Locale) => {
    try {
      const response = await fetch("/api/locale", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ locale: newLocale }),
      });

      if (response.ok) {
        // Refresh the page to apply the new locale
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to change locale:", error);
    }
  };

  return (
    <Select value={locale} onValueChange={handleLocaleChange}>
      <SelectTrigger className="w-[140px]">
        <Globe className="mr-2 h-4 w-4" />
        <SelectValue>
          <span className="flex items-center gap-2">
            <span>{localeFlags[locale]}</span>
            <span>{localeNames[locale]}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {supportedLocales.map((loc) => (
          <SelectItem key={loc} value={loc}>
            <span className="flex items-center gap-2">
              <span>{localeFlags[loc]}</span>
              <span>{localeNames[loc]}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

