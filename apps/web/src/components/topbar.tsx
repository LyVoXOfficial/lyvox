"use client";

import { useI18n, supportedLocales, type Locale } from "@/i18n";

export default function TopBar() {
  const { t } = useI18n();

  const setLocale = (code: Locale) => {
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `locale=${code}; path=/; max-age=${60 * 60 * 24 * 365}`;
    window.location.reload();
  };

  return (
    <div className="w-full bg-zinc-100 text-xs md:text-sm text-zinc-700">
      <div className="mx-auto max-w-6xl px-4 h-8 flex items-center justify-end gap-3">
        <span className="opacity-70">{t("common.language")}:</span>
        {supportedLocales.map((code) => (
          <button key={code} className="hover:underline" onClick={() => setLocale(code)}>
            {code.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
