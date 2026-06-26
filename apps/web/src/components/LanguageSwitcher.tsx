"use client";

import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { useI18n, supportedLocales, type Locale } from "@/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const localeNames: Record<Locale, string> = {
  en: "English",
  ru: "Russian",
  nl: "Nederlands",
  fr: "Français",
  de: "Deutsch",
};

export default function LanguageSwitcher() {
  const { locale } = useI18n();
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
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to change locale:", error);
    }
  };

  return (
    <Select value={locale} onValueChange={handleLocaleChange}>
      <SelectTrigger
        className="h-10 w-auto gap-1.5 rounded-md border-border/80 bg-card shadow-sm"
        aria-label={localeNames[locale]}
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
        {/* Trigger shows just the locale code (never truncates); full names live in the dropdown. */}
        <SelectValue>
          <span className="text-sm font-semibold uppercase">{locale}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {supportedLocales.map((loc) => (
          <SelectItem key={loc} value={loc}>
            <span className="flex items-center gap-2">
              <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                {loc}
              </span>
              <span>{localeNames[loc]}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
