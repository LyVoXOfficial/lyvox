import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Onest, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { getBaseUrl } from "@/lib/seo/baseUrl";
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
import { WebPushRegistrar } from "@/components/WebPushRegistrar";
import { ErrorTrackingProvider } from "@/components/ErrorTrackingProvider";
import { ACCESS_GATE_PATH } from "@/lib/security/accessGate";
import { pathnameHeaderName } from "@/lib/i18n";

// Brand typography — Onest (grotesque with Cyrillic coverage for the ru locale)
// for UI + display, Geist Mono for tabular/numeric data. Exposed as CSS vars and
// wired into --font-sans / --font-mono in globals.css.
const onest = Onest({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-onest",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

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

  const localizedOgCodes = alternateLocale.map((l) =>
    l === "en"
      ? "en_US"
      : l === "nl"
        ? "nl_BE"
        : l === "fr"
          ? "fr_BE"
          : l === "ru"
            ? "ru_RU"
            : l === "de"
              ? "de_DE"
              : l,
  );

  return {
    metadataBase: new URL(getBaseUrl()),
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
      url: getBaseUrl(),
      siteName: "LyVoX",
      locale,
      alternateLocale: localizedOgCodes,
      // No `images` here — apps/web/src/app/opengraph-image.tsx supplies the
      // default 1200x630 PNG automatically for this route and all children
      // that don't define their own.
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { locale, messages } = await getI18nProps();
  const requestHeaders = await headers();

  // The production preview wall gets a deliberately minimal shell. Keeping it
  // outside the marketplace providers prevents hidden navigation, data fetches,
  // and integration failures from leaking through the public holding page.
  if (requestHeaders.get(pathnameHeaderName) === ACCESS_GATE_PATH) {
    return (
      <html lang={locale} className={`${onest.variable} ${geistMono.variable}`}>
        <body className="min-h-screen font-sans">
          <I18nProvider locale={locale} messages={messages}>
            {children}
          </I18nProvider>
        </body>
      </html>
    );
  }

  const { getIntegrationStatus } = await import("@/lib/integrations/registry");
  const [webPush, errorTracking, analytics] = await Promise.all([
    getIntegrationStatus("web_push"),
    getIntegrationStatus("error_tracking"),
    getIntegrationStatus("analytics_insights"),
  ]);
  return (
    <html lang={locale} className={`${onest.variable} ${geistMono.variable}`}>
      <body className="min-h-screen flex flex-col font-sans">
        <I18nProvider locale={locale} messages={messages}>
          <CookieConsentProvider>
            <FavoritesProvider>
              <LikesProvider>
                <TrustGateProvider>
                  <TopBar />
                  <MainHeader />
                  {/* Bottom clearance for the fixed mobile BottomNav is handled solely by
                      ViewportBottomSpacer below (audit B-1/B-3) — do not add a duplicate
                      pb here or content gets double-spaced on generic pages. */}
                  <main className="flex-1 mx-auto max-w-7xl w-full px-4 py-4 md:py-6">
                    {children}
                  </main>
                  <LegalFooter />
                  <ViewportBottomSpacer />
                  <BottomNav />
                </TrustGateProvider>
              </LikesProvider>
            </FavoritesProvider>
            {/* Cookie consent banner + preference center — available app-wide */}
            <CookieBanner />
            <CookiePreferenceCenter />
            <ErrorTrackingProvider
              errorTrackingEnabled={errorTracking.effective}
              analyticsEnabled={analytics.effective}
            />
          </CookieConsentProvider>
        </I18nProvider>
        <WebPushRegistrar enabled={webPush.effective} />
        {/* Global toast container — without this, every toast.* call across the app is silently dropped. */}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
