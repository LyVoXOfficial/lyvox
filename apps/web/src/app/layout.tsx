import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { FavoritesProvider } from "@/components/favorites/FavoritesProvider";
import TopBar from "@/components/topbar";
import MainHeader from "@/components/main-header";
import LegalFooter from "@/components/legal-footer";
import BottomNav from "@/components/bottom-nav";
import ViewportBottomSpacer from "@/components/viewport-bottom-spacer";
import { I18nProvider } from "@/i18n";
import { getI18nProps } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, messages } = await getI18nProps();
  const title = messages?.app?.title ?? "LyVoX";
  const description = messages?.app?.description ?? "";
  const locales = ["en", "fr", "nl", "ru", "de"] as const;
  const alternateLocale = locales.filter((l) => l !== locale);

  const languageAlternates = {
    en: "https://lyvox.be/?lang=en",
    nl: "https://lyvox.be/?lang=nl",
    fr: "https://lyvox.be/?lang=fr",
    ru: "https://lyvox.be/?lang=ru",
    de: "https://lyvox.be/?lang=de",
  } satisfies Record<(typeof locales)[number], string>;

  const localizedOgCodes = alternateLocale.map((l) =>
    l === "en" ? "en_US" : l === "nl" ? "nl_BE" : l === "fr" ? "fr_BE" : l === "ru" ? "ru_RU" : l === "de" ? "de_DE" : l,
  );

  return {
    title,
    description,
    icons: {
      icon: [
        { url: "/favico.svg", type: "image/svg+xml" },
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { url: "/favicon.ico", type: "image/x-icon" },
      ],
      shortcut: ["/favicon.ico"],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
      other: [{ rel: "mask-icon", url: "/lyvox.svg", color: "#11bdf9" }],
    },
    openGraph: {
      title,
      description,
      locale,
      alternateLocale: localizedOgCodes,
      images: [
        {
          url: "/lyvox.svg",
          width: 1024,
          height: 1024,
          alt: "LyVoX",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/lyvox.svg"],
    },
    alternates: {
      languages: languageAlternates,
      icon: ["/favico.svg", "/favicon.ico"],
    },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, messages } = await getI18nProps();
  return (
    <html lang={locale}>
      <body className="min-h-screen flex flex-col">
        <I18nProvider locale={locale} messages={messages}>
          <FavoritesProvider>
            <TopBar />
            <MainHeader />
            <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-4 md:py-6 pb-[calc(64px+env(safe-area-inset-bottom))]">{children}</main>
            <LegalFooter />
            <ViewportBottomSpacer />
            <BottomNav />
          </FavoritesProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
