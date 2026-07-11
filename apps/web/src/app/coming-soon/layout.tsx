import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getI18nProps } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, messages } = await getI18nProps();
  const copy = messages?.access_gate ?? {};
  const title = copy.meta_title ?? "LyVoX — Private preview";
  const description =
    copy.meta_description ??
    "LyVoX is preparing for its public launch in Belgium.";
  const ogLocale =
    locale === "nl"
      ? "nl_BE"
      : locale === "fr"
        ? "fr_BE"
        : locale === "de"
          ? "de_DE"
          : locale === "ru"
            ? "ru_RU"
            : "en_US";

  return {
    title,
    description,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      url: "/",
      siteName: "LyVoX",
      locale: ogLocale,
      title,
      description,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "LyVoX — Local marketplace for Belgium",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image"],
    },
    robots: {
      index: false,
      follow: false,
      nocache: true,
    },
  };
}

export default function ComingSoonLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
