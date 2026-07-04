import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/baseUrl";
import { localizePath, supportedLocales } from "@/lib/i18n";

const PRIVATE_PATHS = [
  "/api/",
  "/admin",
  "/profile",
  "/chat",
  "/post",
  "/favorites",
  "/compare",
  "/register",
  "/login",
  "/verify",
  "/pro",
];

export default function robots(): MetadataRoute.Robots {
  const localizedPrivatePaths = supportedLocales.flatMap((locale) =>
    PRIVATE_PATHS.map((path) => localizePath(path, locale)),
  );

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...PRIVATE_PATHS, ...localizedPrivatePaths],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
