import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { FavoritesProvider } from "@/components/favorites/FavoritesProvider";
import { LikesProvider } from "@/components/likes/LikesProvider";
import TopBar from "@/components/topbar";
import MainHeader from "@/components/main-header";
import LegalFooter from "@/components/legal-footer";
import BottomNav from "@/components/bottom-nav";
import ViewportBottomSpacer from "@/components/viewport-bottom-spacer";
import { I18nProvider } from "@/i18n";
import { getI18nProps } from "@/i18n/server";
import { TrustGateProvider } from "@/components/trust/TrustGateProvider";
import { CookieConsentProvider } from "@/components/cookie/CookieConsentProvider";
import { CookieBanner } from "@/components/cookie/CookieBanner";
import { CookiePreferenceCenter } from "@/components/cookie/CookiePreferenceCenter";
import { Toaster } from "sonner";

// `viewport-fit: cover` is required for the `env(safe-area-inset-*)` paddings
// used by the bottom nav to be non-zero on notched devices (iOS). themeColor
// sets the mobile browser chrome and is a prerequisite for PWA work.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#11bdf9",
};

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
        { url: "/favicon.svg", type: "image/svg+xml" },
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/favicon.ico", type: "image/x-icon" },
      ],
      shortcut: ["/favicon.ico"],
      apple: [{ url: "/favicon.svg", type: "image/svg+xml" }],
      other: [{ rel: "mask-icon", url: "/favicon.svg", color: "#11bdf9" }],
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
    },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, messages } = await getI18nProps();
  return (
    <html lang={locale}>
      <body className="min-h-screen flex flex-col">
        <I18nProvider locale={locale} messages={messages}>
          <CookieConsentProvider>
            <FavoritesProvider>
              <LikesProvider>
                <TrustGateProvider>
                  <TopBar />
                  <MainHeader />
                  <main className="flex-1 mx-auto max-w-7xl w-full px-4 py-4 md:py-6 pb-[calc(64px+env(safe-area-inset-bottom))]">{children}</main>
                  <LegalFooter />
                  <ViewportBottomSpacer />
                  <BottomNav />
                </TrustGateProvider>
              </LikesProvider>
            </FavoritesProvider>
            {/* Cookie consent banner + preference center — available app-wide */}
            <CookieBanner />
            <CookiePreferenceCenter />
          </CookieConsentProvider>
        </I18nProvider>
        {/* Global toast container — without this, every toast.* call across the app is silently dropped. */}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
